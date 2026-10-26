FROM oven/bun:1.4.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS tooling
COPY . .

FROM tooling AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build
RUN bun build scripts/start-container.ts --target=bun --packages=external --outdir=runtime

FROM oven/bun:1.4.4 AS production-dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/.next ./.next
COPY --from=build --chown=bun:bun /app/public ./public
COPY --from=build --chown=bun:bun /app/package.json ./package.json
COPY --from=build --chown=bun:bun /app/next.config.ts ./next.config.ts
COPY --from=build --chown=bun:bun /app/runtime ./runtime
USER bun
EXPOSE 3000
CMD ["bun", "runtime/start-container.js"]
