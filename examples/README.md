# Examples

Everything here is applied with plain `kubectl`; there is no Helm in this lab.

```sh
export NS=<your-username>
kubectl config set-context --current --namespace="$NS"
kubectl apply -f examples/1-login-screen/
```

## The examples

| folder | what it shows |
|---|---|
| [`login-screen-bun/`](login-screen-bun) | the app: Bun + Hono login screen, Argon2id verification, health and metrics endpoints |
| [`1-login-screen/`](1-login-screen) | Deployment + Service + `autoscaling/v2` HPA (1-10 replicas, 50% CPU target) |
| [`2-load-generator/`](2-load-generator) | two curl Pods posting real login forms in a loop |
| [`optional-ingress/`](optional-ingress) | publish the screen at `https://login.<username>.sapi.click` (render with `sed` before applying) |

## Conventions

- **No hard-coded namespace.** The manifests land in the namespace of your
  current kubeconfig context. Set it with `kubectl config set-context
  --current --namespace="$NS"` (or pass `-n "$NS"`).
- **CPU requests matter.** The HPA computes utilisation as a percentage of
  `resources.requests.cpu`; the Deployment sets `requests.cpu: 200m`, so a 50%
  target means 100m average per Pod.
- **Images are multi-arch.** The workers are `arm64`; build with
  `--platform linux/amd64,linux/arm64` if you publish your own.
- **DNS and TLS are automatic.** The optional Ingress needs only
  `ingressClassName: traefik` and a `tls:` host; no annotations.

## Order of operations

```sh
kubectl apply -f examples/1-login-screen/10-deployment.yaml
kubectl apply -f examples/1-login-screen/20-service.yaml
kubectl rollout status deployment/login-screen

kubectl apply -f examples/1-login-screen/40-hpa.yaml
kubectl get hpa login-screen

kubectl apply -f examples/2-load-generator/50-load-generator.yaml
kubectl get hpa login-screen --watch
```

Stop the load with:

```sh
kubectl delete -f examples/2-load-generator/50-load-generator.yaml
```

The HPA scales back to one replica after its stabilisation window; see the
[main README](../README.md) for the full walkthrough.
