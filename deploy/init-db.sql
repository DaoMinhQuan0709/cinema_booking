\getenv app_password DB_PASSWORD

BEGIN;
CREATE ROLE cinema LOGIN PASSWORD :'app_password';
ALTER SCHEMA public OWNER TO cinema;
COMMIT;
