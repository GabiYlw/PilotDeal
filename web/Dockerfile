# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# output: "standalone" in next.config.ts makes the build emit .next/standalone: a server.js plus
# only the node_modules files the server actually uses.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# lib/api.ts throws when API_URL is unset, and prerendering reaches it before the request-time
# fetch is deferred. The value is only read at request time, so compose sets the real one.
ARG API_URL=http://api:3001
ENV API_URL=$API_URL
# Sub-path to serve the app under (docker-compose.prod.yml passes /demo). Inlined at build time,
# so changing it needs a rebuild. Empty serves the app at /.
ARG BASE_PATH=
ENV BASE_PATH=$BASE_PATH
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
# The standalone server does not include static assets; copy them next to it so it serves them.
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
