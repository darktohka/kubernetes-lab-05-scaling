# login-screen-bun

A deliberately small [Bun](https://bun.sh) + [Hono](https://hono.dev) login
service used as the workload for the HorizontalPodAutoscaler lab.

The interesting property is not the UI - it is the cost of a login. Each
`POST /login` verifies an **Argon2id** hash (`m=65536 KiB`, `t=3`, `p=1`),
which burns roughly 150-350 ms of one CPU core depending on the node. That
gives the HPA a predictable, explainable CPU signal instead of an opaque busy
loop.

## Credentials

```text
username: student
password: testpassword
```

The Argon2id hash and its parameters are in a comment in
[`src/index.ts`](src/index.ts). This is a demo: never keep credentials like this
in a real service.

## Endpoints

| Method | Path | Response |
|---|---|---|
| `GET` | `/` | the login page |
| `POST` | `/login` | `200` + welcome HTML on success, `401` + form on failure; JSON when `Accept: application/json` |
| `GET` | `/healthz` | `ok` |
| `GET` | `/readyz` | `ok` |
| `GET` | `/metrics` | plain-text counters (`lab05_logins_total`, `lab05_login_failures_total`, `lab05_in_flight_requests`) |

The server listens on `PORT` (default `3000`).

## Run locally

```sh
bun install
bun run src/index.ts

curl -sS http://127.0.0.1:3000/healthz
# ok

curl -sS -X POST http://127.0.0.1:3000/login \
  -H 'Accept: application/json' \
  --data-urlencode username=student \
  --data-urlencode password=testpassword
# {"ok":true,"username":"student"}

time curl -sS -o /dev/null -X POST http://127.0.0.1:3000/login \
  -H 'Accept: application/json' \
  --data-urlencode username=student \
  --data-urlencode password=testpassword
```

## Build and push

The cluster has both `amd64` and `arm64` nodes. Build a manifest list:

```sh
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t lighthouse.tohka.us/example-projects/login-screen-bun:latest \
  --push .
```

Or from the repository root:

```sh
./scripts/build-and-push.sh lighthouse.tohka.us/example-projects login-screen-bun latest
```

The container runs as UID/GID `1001`, drops all capabilities and works with a
read-only root filesystem. It serves plain HTTP on port `3000`; TLS is
terminated by the Ingress.

## Notes on the image

- Base: `oven/bun:1.4.4-alpine` (multi-arch).
- Bun executes the TypeScript directly; there is no build step.
- `bun install --frozen-lockfile --production` keeps the runtime dependency
  tree (`hono`) reproducible.
- `readOnlyRootFilesystem` is safe because the app writes nothing to disk.
- Health endpoints exist for Kubernetes probes; `/metrics` is for humans, not
  for the HPA (the HPA reads CPU from metrics-server).
