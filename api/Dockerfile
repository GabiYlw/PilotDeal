# syntax=docker/dockerfile:1

# Debian slim, not Alpine: onnxruntime-node (embeddings) ships glibc binaries only.
FROM node:22-bookworm-slim AS base
WORKDIR /app
# Prisma's migration engine needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# All dependencies, Prisma client generation (postinstall) and the TypeScript build.
FROM base AS build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Production dependencies only. Install scripts stay on so Prisma's migration engine is downloaded
# now, not at container start.
FROM base AS prod-deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
# Size: keep only the onnxruntime-node binaries for the architecture being built (TARGETARCH is
# set by BuildKit: amd64 -> linux/x64, arm64 -> linux/arm64), and drop onnxruntime-web
# (transformers.js bundles what it needs from it). Pruned here, not with a RUN rm in the final
# stage, because files deleted after a COPY still take space in the COPY layer.
# The model stage below loads the model with these pruned dependencies, so a wrong prune fails
# the build.
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      amd64) ort_arch=x64 ;; \
      arm64) ort_arch=arm64 ;; \
      *) echo "Unsupported TARGETARCH '$TARGETARCH': expected amd64 or arm64" >&2; exit 1 ;; \
    esac \
  && for napi in node_modules/onnxruntime-node/bin/napi-v*; do \
       keep="$napi/linux/$ort_arch"; \
       if [ ! -d "$keep" ]; then echo "Missing onnxruntime-node binary: $keep" >&2; exit 1; fi; \
       find "$napi" -mindepth 2 -maxdepth 2 ! -path "$keep" -exec rm -rf {} +; \
       find "$napi" -mindepth 1 -maxdepth 1 -type d -empty -delete; \
     done \
  && rm -rf node_modules/onnxruntime-web

# Downloads the embedding model into a fixed directory, so containers never download it.
FROM prod-deps AS model
ENV EMBEDDING_CACHE_DIR=/app/models
COPY --from=build /app/dist ./dist
RUN node dist/src/scripts/download-embedding-model.js

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    EMBEDDING_CACHE_DIR=/app/models \
    EMBEDDING_OFFLINE=true \
    PATH=/app/node_modules/.bin:$PATH
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=model /app/models ./models
USER node
EXPOSE 3001
# Apply pending migrations, then replace the shell with Node so it receives SIGTERM directly.
CMD ["sh", "-c", "prisma migrate deploy && exec node dist/src/server.js"]
