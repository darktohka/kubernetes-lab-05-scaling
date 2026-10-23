# Bun 1.4.x, Alpine variant. Bun runs TypeScript directly, so there is no
# separate compile step; the only thing this image needs is the dependency tree.
FROM oven/bun:1.4.4-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

# Never run the workload as root. The image is used in a cluster with Pod
# Security Admission in `baseline` (and audited as `restricted`) mode.
RUN addgroup -S app && adduser -S -G app -u 1001 app && chown -R app:app /app
USER app

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# The process is stateless: SIGTERM is enough for a clean rollout.
STOPSIGNAL SIGTERM

CMD ["bun", "run", "src/index.ts"]
