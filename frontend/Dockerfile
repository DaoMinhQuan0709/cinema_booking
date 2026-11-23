# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY src src
COPY public public
ENV VITE_API_BASE_URL=/api/v1 VITE_WS_BASE_URL=/ws
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /build/dist /srv
