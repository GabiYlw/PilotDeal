# syntax=docker/dockerfile:1

# The public entry point: builds the presentation site (static export) and serves it with Caddy,
# which also terminates HTTPS and proxies /demo to the web container.
# Build context: this folder (Caddyfile). The site sources come from the "site" build context
# (additional_contexts in docker-compose.prod.yml). The build stage must not be named "site":
# a named build context shadows a stage with the same name.

FROM node:22-bookworm-slim AS site-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=site package.json package-lock.json ./
RUN npm ci
COPY --from=site . .
RUN npm run build

FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=site-build /app/out /srv/site
