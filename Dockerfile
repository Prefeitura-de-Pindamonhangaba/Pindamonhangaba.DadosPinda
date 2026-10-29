# syntax=docker/dockerfile:1
FROM oven/bun:1.4.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,id=pinda-bun-1.4.4,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# Ferramentas e migrações não precisam recompilar a interface.
FROM dependencies AS tooling
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY docs/legacy-reference-data.json ./docs/legacy-reference-data.json
RUN bun build scripts/bootstrap.ts --target=bun --outdir=runtime

# O serviço init usa apenas o verificador compilado, sem ferramentas de desenvolvimento.
FROM oven/bun:1.4.4 AS bootstrap
WORKDIR /app
COPY --from=tooling --chown=bun:bun /app/runtime ./runtime
COPY --from=tooling --chown=bun:bun /app/drizzle ./drizzle
USER bun
ENTRYPOINT ["bun", "runtime/bootstrap.js"]

# Somente arquivos que participam da compilação da aplicação.
FROM dependencies AS source
COPY next.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public

FROM source AS build
ARG NEXT_BUILD_CPUS=2
ENV NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_STANDALONE=true
RUN --mount=type=cache,id=pinda-next,target=/app/.next/cache,sharing=locked \
    bun run build
COPY scripts/start-container.ts ./scripts/start-container.ts
RUN bun build scripts/start-container.ts --target=bun --outdir=runtime

FROM oven/bun:1.4.4 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_STANDALONE=true
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
COPY --from=build --chown=bun:bun /app/runtime ./runtime
USER bun
EXPOSE 3000
CMD ["bun", "runtime/start-container.js"]
