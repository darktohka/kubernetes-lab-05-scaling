#!/usr/bin/env sh
# Build the login-screen app for both cluster architectures and push it.
#
#   ./scripts/build-and-push.sh <registry>/<namespace> [repository] [tag]
#
# Examples:
#   ./scripts/build-and-push.sh lighthouse.tohka.us/example-projects login-screen-bun latest
#   ./scripts/build-and-push.sh docker.io/youruser login-screen-bun v1
#
# The cluster has amd64 and arm64 nodes, so a single-architecture image will
# fail with "exec format error" on at least one of them.

set -eu

REGISTRY="${1:?usage: $0 <registry>/<namespace> [repository] [tag]}"
REPOSITORY="${2:-login-screen-bun}"
TAG="${3:-latest}"

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONTEXT="$ROOT/examples/login-screen-bun"
IMAGE="$REGISTRY/$REPOSITORY:$TAG"

if ! docker buildx version >/dev/null 2>&1; then
  echo "docker buildx is required" >&2
  exit 1
fi

echo "==> building $IMAGE for linux/amd64 + linux/arm64"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "$IMAGE" \
  --push \
  "$CONTEXT"

echo
echo "==> manifest"
docker buildx imagetools inspect "$IMAGE"

echo
echo "Deploy it with:"
echo "  kubectl set image deployment/login-screen app=$IMAGE"
