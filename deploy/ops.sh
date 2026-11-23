#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { printf '%s\n' "$*" >&2; exit 1; }

action=${1:-}
case "$action" in
  release)
    [[ $# == 3 ]] || fail 'Usage: bash deploy/ops.sh release /path/release.env /path/backup-directory'
    manifest=$(realpath -e -- "$2")
    backup_dir=$(realpath -e -- "$3")
    ;;
  rollback)
    [[ $# -le 2 ]] || fail 'Usage: bash deploy/ops.sh rollback [/path/release.env]'
    manifest=.env.previous
    if [[ $# == 2 ]]; then manifest=$(realpath -e -- "$2"); fi
    ;;
  backup)
    [[ $# == 2 ]] || fail 'Usage: bash deploy/ops.sh backup /path/backup-directory'
    manifest=.env.release
    backup_dir=$(realpath -e -- "$2")
    ;;
  seed)
    [[ $# == 1 ]] || fail 'Usage: bash deploy/ops.sh seed'
    manifest=.env.release
    ;;
  *) fail 'Choose release, rollback, backup or seed.' ;;
esac

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ -s .env ]] || fail 'Create deploy/.env from deploy/.env.example first.'
exec 9>.env.ops.lock
flock -w 120 9 || fail 'Another deployment operation is running.'
[[ -s "$manifest" ]] || fail "Release manifest is missing ($manifest)."

commit=$(sed -n 's/^RELEASE_COMMIT=//p' "$manifest")
frontend_image=$(sed -n 's/^FRONTEND_IMAGE=//p' "$manifest")
backend_image=$(sed -n 's/^BACKEND_IMAGE=//p' "$manifest")
image_pattern='^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$'
[[ "$commit" =~ ^[a-f0-9]{40}$ && "$frontend_image" =~ $image_pattern && "$backend_image" =~ $image_pattern ]] \
  || fail 'Use the commit and image digests from the release artifact.'
export FRONTEND_IMAGE="$frontend_image" BACKEND_IMAGE="$backend_image"

dc() { docker compose -f compose.yaml --env-file .env --project-name cinema-demo "$@"; }

app_psql() {
  # Expand the password inside the PostgreSQL container.
  # shellcheck disable=SC2016
  dc exec -T postgres sh -ec '
    export PGPASSWORD="$DB_PASSWORD"
    exec psql -X -h 127.0.0.1 -U cinema -d cinema -v ON_ERROR_STOP=1 "$@"
  ' psql "$@"
}

backup_tmp=
release_tmp=
previous_tmp=
cleanup() {
  if [[ -n "$backup_tmp" ]]; then rm -f -- "$backup_tmp"; fi
  if [[ -n "$release_tmp" ]]; then rm -f -- "$release_tmp"; fi
  if [[ -n "$previous_tmp" ]]; then rm -f -- "$previous_tmp"; fi
}
trap cleanup EXIT

backup() {
  [[ -d "$backup_dir" && -w "$backup_dir" ]] || fail "Backup directory is unavailable ($backup_dir)."
  backup_tmp=$(mktemp "$backup_dir/.cinema.XXXXXX")
  # shellcheck disable=SC2016
  dc exec -T postgres sh -ec '
    export PGPASSWORD="$DB_PASSWORD"
    exec pg_dump -h 127.0.0.1 -U cinema -d cinema --format=custom --no-owner --no-acl
  ' > "$backup_tmp"
  dc exec -T postgres pg_restore --list < "$backup_tmp" > /dev/null
  local destination
  destination="$backup_dir/cinema-$(date -u +%Y%m%dT%H%M%SZ)-${backup_tmp##*.}.dump"
  mv -- "$backup_tmp" "$destination"
  backup_tmp=
  printf 'PostgreSQL backup saved to %s\n' "$destination"
}

start_web() {
  dc up -d --no-deps --wait --wait-timeout 120 backend frontend
  local origin content_type ipn_response
  origin=$(dc exec -T frontend printenv CINEMA_SITE_ADDRESS)
  local probe=(curl --fail --silent --show-error --max-time 10 --retry 6 --retry-all-errors --retry-delay 3)
  "${probe[@]}" --output /dev/null "$origin/payment/vnpay-callback"
  content_type=$("${probe[@]}" --output /dev/null --write-out '%{content_type}' "$origin/api/v1/movies")
  [[ "$content_type" == application/json* ]] || fail 'Catalog did not return JSON through the public URL.'
  ipn_response=$("${probe[@]}" "$origin/api/v1/payments/vnpay-ipn")
  grep -Eq '"RspCode"[[:space:]]*:[[:space:]]*"97"' <<< "$ipn_response" || fail 'VNPay IPN did not reach the backend.'

  local version
  version=$(app_psql -Atc 'SELECT version FROM flyway_schema_history WHERE success AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1')
  [[ "$version" =~ ^[0-9]+([.][0-9]+)*$ ]] || fail 'Could not identify the applied schema version.'
  release_tmp=$(mktemp .env.release.XXXXXX)
  printf 'RELEASE_COMMIT=%s\nFRONTEND_IMAGE=%s\nBACKEND_IMAGE=%s\nSCHEMA_VERSION=%s\n' \
    "$commit" "$frontend_image" "$backend_image" "$version" > "$release_tmp"
  if [[ -s .env.release ]] && ! cmp -s .env.release "$release_tmp"; then
    previous_tmp=$(mktemp .env.previous.XXXXXX)
    cp -- .env.release "$previous_tmp"
    mv -- "$previous_tmp" .env.previous
    previous_tmp=
  fi
  mv -- "$release_tmp" .env.release
  release_tmp=
  printf 'Active release %s with schema %s\n' "$commit" "$version"
}

case "$action" in
  release)
    [[ "$commit" == "$(git rev-parse HEAD)" ]] || fail 'Check out the release commit before applying its migrations.'
    [[ -z "$(git status --porcelain --untracked-files=all -- compose.yaml init-db.sql migrations seed-demo.sql)" ]] \
      || fail 'Restore the deployment files to the release commit before applying migrations.'
    [[ -d "$backup_dir" && -w "$backup_dir" ]] || fail "Backup directory is unavailable ($backup_dir)."
    dc config --quiet
    dc pull backend frontend
    dc pull --policy missing postgres redis migrate
    dc up -d --wait --wait-timeout 90 postgres redis
    dc stop backend
    backup
    dc run --rm --no-deps migrate
    if [[ ! -s .env.release ]]; then
      app_psql < seed-demo.sql
      manual=../backend/cinema-booking-backend/src/main/resources/db/manual
      app_psql < "$manual/seed-products.sql"
      app_psql < "$manual/update-product-images.sql"
    fi
    start_web
    ;;
  rollback)
    dc pull backend frontend
    start_web
    ;;
  backup) backup ;;
  seed) app_psql < seed-demo.sql ;;
esac
