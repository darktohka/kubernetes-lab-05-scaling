# Microservices and Kubernetes: Lab 5 - Autoscaling with HorizontalPodAutoscaler

Lab 4 ended with a Deployment running behind a Service and an Ingress. That
Deployment had a fixed `replicas:` value: you decided how many Pods existed, and
Kubernetes kept exactly that many alive.

This lab removes the fixed number. A **HorizontalPodAutoscaler (HPA)** watches a
workload, compares the resource usage of its Pods with a target, and updates the
workload's replica count to keep the two in line. When demand rises, more Pods
appear; when it falls, they disappear.

You will run that loop against a real, CPU-bound login service:

1. Deploy a Bun application with a login screen. Every login verifies an
   **Argon2id** password hash - deliberately expensive work that gives us a
   clean CPU signal to scale on.
2. Create an HPA that keeps average CPU at **50% of the container's CPU
   request**, with **1 to 10 replicas**.
3. Generate real login traffic, watch the HPA add Pods, then stop the traffic
   and watch it remove them again.
4. Learn the algorithm, the metrics pipeline and the knobs (`behavior`,
   tolerance, requests vs limits) that decide whether the autoscaler behaves
   well or thrashes.

> **Environment.** Everything targets the shared `sapi.click` Kubernetes cluster.

---

## 1. The workload: a login screen that costs CPU

### 1.1 Argon2id in one paragraph

Argon2id is a memory-hard password-hashing function (RFC 9106). It is designed
to make guessing passwords expensive: verification takes a configurable amount
of CPU and memory, so an attacker cannot try billions of candidates per second.
That is exactly what a password store should do - and exactly what makes it a
good load generator for an HPA.

The demo uses:

```text
algorithm   Argon2id
memory      65536 KiB  (64 MiB)
iterations  3
parallelism 1
cost        roughly 150-350 ms of one CPU core per verification,
            depending on the node (the arm64 workers are slower at Argon2)
```

Every `POST /login` performs one verification, whether the username exists or
not. Wrong credentials therefore cost the same as correct ones; the service
does not leak account existence through timing. The credentials are:

```text
username: student
password: testpassword
```

The hash and the exact parameters are in a comment in
[`examples/login-screen-bun/src/index.ts`](examples/login-screen-bun/src/index.ts).
This is a demo: a real service keeps the hash in a database, serves over TLS,
rate-limits attempts and adds a second factor.

### 1.2 The endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | the login page |
| `POST` | `/login` | verify `username` + `password`; HTML for browsers, JSON for `Accept: application/json` |
| `GET` | `/healthz` | liveness probe |
| `GET` | `/readyz` | readiness probe |
| `GET` | `/metrics` | plain-text counters: logins, failures, in-flight requests |

The application is stateless. There is no session cookie and no database; the
"welcome" page only confirms that the password verified. That keeps the lab
focused on scaling instead of authentication plumbing.

### 1.3 Deploy it

```sh
kubectl apply -f examples/1-login-screen/10-deployment.yaml
kubectl apply -f examples/1-login-screen/20-service.yaml

kubectl rollout status deployment/login-screen
kubectl get pods -l app.kubernetes.io/name=login-screen
kubectl get svc login-screen
```

The Deployment asks for `200m` CPU and limits the container to `500m`:

```yaml
resources:
  requests: { cpu: 200m, memory: 128Mi }
  limits:   { cpu: 500m, memory: 512Mi }
```

### 1.4 Try the login screen

Forward the Service to your machine (no Ingress required):

```sh
kubectl port-forward svc/login-screen 8080:80
```

Open <http://localhost:8080> and sign in with `student` / `testpassword`. You
should see the welcome page. A wrong password returns the form with an error.

The same thing from the command line:

```sh
# success -> 200 {"ok":true,"username":"student"}
curl -sS -X POST http://localhost:8080/login \
  -H 'Accept: application/json' \
  --data-urlencode username=student \
  --data-urlencode password=testpassword

# failure -> 401 {"ok":false,"error":"Invalid username or password"}
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/login \
  -H 'Accept: application/json' \
  --data-urlencode username=student \
  --data-urlencode password=wrong
```

Time one request to see the cost:

```sh
time curl -sS -o /dev/null -X POST http://localhost:8080/login \
  -H 'Accept: application/json' \
  --data-urlencode username=student \
  --data-urlencode password=testpassword
```

Expect roughly 0.15-0.3 s of wall time, most of it Argon2 on the server. That
is the CPU the HPA will react to.

> **Optional Ingress.** To publish the screen instead of forwarding a port,
> render the optional manifest with your own host:
>
> ```sh
> sed "s/<username>/$NS/g" examples/optional-ingress/30-ingress.yaml | kubectl apply -f -
> curl -I "https://login.$NS.sapi.click"
> ```
>
> DNS and the certificate are automatic, but a new host can take a minute. Skip
> this if you only care about autoscaling; the load generator never uses it.

---

## 2. Create the HorizontalPodAutoscaler

### 2.1 The declarative way (use this)

```sh
kubectl apply -f examples/1-login-screen/40-hpa.yaml
kubectl get hpa login-screen
```

Output shortly after creation:

```text
NAME           REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
login-screen   Deployment/login-screen   cpu: 0%/50%   1         10        1          30s
```

`0%/50%` is correct: nobody is logging in yet, so the Pod is idle. The first
number is the **average CPU utilisation across ready Pods**, expressed as a
percentage of the CPU *request*. The second is the target.

> For the first 30-60 seconds, `TARGETS` may show `<unknown>/50%` while
> metrics-server collects the first sample. That is expected.

Look at the whole object:

```sh
kubectl describe hpa login-screen
```

Things to notice:

- `ScaleTargetRef: Deployment/login-screen`;
- `Min replicas: 1`, `Max replicas: 10`;
- `cpu resource utilization (percentage of request): 50%`;
- `Conditions:` `AbleToScale`, `ScalingActive` and `ScalingLimited`.

`ScalingLimited=False` means "nothing is stopping me from scaling". A `True`
condition with reason `TooManyReplicas` or `TooFewReplicas` means the HPA wants
to go further but `minReplicas`/`maxReplicas` stops it.

### 2.2 The imperative way

`kubectl autoscale` creates the same object with fewer keystrokes:

```sh
kubectl delete hpa login-screen --ignore-not-found
kubectl autoscale deployment login-screen --cpu=50% --min=1 --max=10
```

On a current cluster this creates an `autoscaling/v2` HPA, but it uses the
**default** `behavior` - notably a 300-second scale-down stabilisation window.
The YAML in this repository is the same idea plus explicit, faster behaviour so
you can watch the full cycle in a lab session.

Use one or the other, not both: `kubectl apply -f examples/1-login-screen/40-hpa.yaml` after
`kubectl autoscale` simply updates the existing object, and deleting one while
the other is applied can leave you debugging the wrong manifest.

### 2.3 What the controller will do

The HPA does not touch Pods directly. It updates the **scale subresource** of
the Deployment:

```text
HPA controller  ──patch scale──▶  Deployment  ──▶  ReplicaSet  ──▶  Pods
      ▲                                                              │
      └────────── CPU metrics (metrics-server) ◀── kubelet ◀─────────┘
```

That indirection is why an HPA works with a Deployment, StatefulSet,
ReplicaSet or ReplicationController, but **not with a bare Pod**: a Pod has no
scale subresource and nothing that can create more copies of it.

---

## 3. Increase the load

### 3.1 Start the generator

The load generator is a Deployment of two `curlimages/curl` Pods. Each one posts
the real login form to `http://login-screen/login` in a loop, with a 200 ms
pause between requests:

```sh
kubectl apply -f examples/2-load-generator/50-load-generator.yaml
kubectl get pods -l app.kubernetes.io/name=load-generator
```

Watch its logs - every line is one login attempt and its HTTP status:

```sh
kubectl logs -f deployment/load-generator --tail=10
```

```text
load-generator: POST http://login-screen/login every 0.2s
13:42:07 200
13:42:07 200
13:42:08 200
```

Two replicas keep the Service busy without hammering the cluster: expect a
handful of login attempts per second, depending on how fast the nodes verify
Argon2. If you want more or less pressure, change `spec.replicas` or the
`LOAD_SLEEP` environment variable in the manifest:

```sh
kubectl scale deployment/load-generator --replicas=4
kubectl set env deployment/load-generator LOAD_SLEEP=0.05
```

### 3.2 Watch the HPA

In a second terminal:

```sh
kubectl get hpa login-screen --watch
```

Within a minute or so (a 15 s metrics scrape plus a 15 s HPA sync), the target
leaves zero:

```text
NAME           REFERENCE                 TARGETS          MINPODS   MAXPODS   REPLICAS   AGE
login-screen   Deployment/login-screen   cpu: 230%/50%    1         10        1          3m
login-screen   Deployment/login-screen   cpu: 230%/50%    1         10        5          3m
login-screen   Deployment/login-screen   cpu: 53%/50%     1         10        7          4m
login-screen   Deployment/login-screen   cpu: 41%/50%     1         10        7          5m
```

The exact numbers depend on how fast the nodes are and how the requests land.
What matters is the direction: utilisation is far above 50%, so the HPA adds
Pods, which spreads the same work over more replicas and brings the average
down toward the target. In the run above it settled at seven replicas, with the
average hovering just under 50%.

Watch the Deployment and the Pods in parallel:

```sh
kubectl get deployment login-screen --watch
kubectl get pods -l app.kubernetes.io/name=login-screen --watch
kubectl top pods -l app.kubernetes.io/name=login-screen
```

The Deployment's `READY` column should track the HPA's `REPLICAS`:

```text
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
login-screen   7/7     7            7           6m
```

### 3.3 See the decisions the HPA made

```sh
kubectl describe hpa login-screen
```

At the bottom, the Events are the most useful part:

```text
Events:
  Type    Reason             Age   From                       Message
  ----    ------             ----  ----                       -------
  Normal  SuccessfulRescale  2m    horizontal-pod-autoscaler  New size: 3; reason: cpu resource utilization (percentage of request) above target
  Normal  SuccessfulRescale  90s   horizontal-pod-autoscaler  New size: 5; reason: cpu resource utilization (percentage of request) above target
  Normal  SuccessfulRescale  75s   horizontal-pod-autoscaler  New size: 7; reason: cpu resource utilization (percentage of request) above target
```

Each event is one scale operation. There is no event for "I checked and did
nothing", which is why an HPA can look idle in `describe` while it is working
perfectly.

### 3.4 Why it stops where it does

The load is not unlimited. Once the average utilisation falls to the target
(within tolerance), the HPA stops adding Pods. If it reaches `maxReplicas`, the
`ScalingLimited` condition becomes `True`:

```sh
kubectl get hpa login-screen -o yaml | grep -A6 conditions
```

That is not an error. It means "the demand is higher than the policy allows".
In production you would raise `maxReplicas`, lower the target, or add capacity
(section 9).

---

## 4. Stop the load and watch it scale down

Delete the generator:

```sh
kubectl delete -f examples/2-load-generator/50-load-generator.yaml
```

Keep watching:

```sh
kubectl get hpa login-screen --watch
kubectl get deployment login-screen --watch
```

The CPU target drops almost immediately, but the replica count does **not**:

```text
login-screen   Deployment/login-screen   cpu: 0%/50%   1   10   7   12m
```

That pause is deliberate. The HPA's scale-down `stabilizationWindowSeconds` is
**120 s** in this lab (the default is 300 s). During that window the controller
remembers the highest recommendation it saw, so a brief dip in traffic does not
destroy a warm fleet that the next request will need again. After the window,
the scale-down policies remove at most **2 Pods per 30 s**:

```text
login-screen   Deployment/login-screen   cpu: 0%/50%   1   10   5   13m
login-screen   Deployment/login-screen   cpu: 0%/50%   1   10   3   14m
login-screen   Deployment/login-screen   cpu: 0%/50%   1   10   1   15m
```

Depending on where the load stopped relative to the sync loop, the whole
scale-down takes roughly 3-5 minutes. That is normal. Do not "fix" it by setting
the stabilisation window to zero unless you actually want a workload that
reacts to every spike.

---

## 5. How the HPA decides

### 5.1 The control loop

Every **15 seconds** by default, the HPA controller:

1. reads the target's scale subresource (current replicas);
2. fetches the metric for each Pod from the metrics API;
3. excludes Pods that are not `Ready` or have no metric yet;
4. computes the average utilisation across the remaining Pods;
5. computes a desired replica count;
6. applies tolerance, `minReplicas`/`maxReplicas` and `behavior`;
7. patches the scale subresource if the result differs.

The metrics themselves arrive through a chain:

```text
cAdvisor / kubelet  ──▶  metrics-server  ──▶  metrics.k8s.io/v1beta1  ──▶  HPA
   (per container)        (scrapes every      (APIService)              (every 15 s)
                           15 s)
```

`metrics-server` is an **aggregation layer**, not a monitoring system. It keeps
only the latest reading per Pod, which is why `kubectl top` shows a point in
time and why the HPA cannot scale on historical data. For dashboards and
long-term history you need Prometheus (or similar); the HPA does not need it.

### 5.2 The algorithm

For a resource metric with a `Utilization` target:

```text
desiredReplicas = ceil( currentReplicas × (currentUtilization / targetUtilization) )
```

With `currentReplicas = 2`, `currentUtilization = 120%`, `target = 50%`:

```text
ceil(2 × 120 / 50) = ceil(4.8) = 5
```

So a single HPA tick can more than double the fleet. That is why the `behavior`
policies exist: the algorithm is intentionally aggressive, and the policies put
a rate limit on it.

The controller also applies a **tolerance** (10% by default). If the ratio is
within `0.9 … 1.1`, it does nothing. Without tolerance, a workload sitting at
51% would scale up, drop to 49%, scale down, and oscillate forever.

### 5.3 Requests, not limits

The percentage is relative to `resources.requests.cpu`:

| request | limit | target | scale-up threshold |
|---|---|---|---|
| `200m` | `500m` | `50%` | average **100m** per Pod |
| `400m` | `500m` | `50%` | average **200m** per Pod |
| `200m` | `500m` | `80%` | average **160m** per Pod |

The limit only caps what the kernel lets the container use. A Pod at its
`500m` limit with a `200m` request reports **250%** utilisation. That is not a
bug; it is the HPA telling you the Pod is working five times harder than the
capacity you reserved for it.

If a container has **no CPU request**, the HPA cannot compute a percentage and
reports:

```text
TARGETS   <unknown>/50%
```

or an error condition such as `FailedGetResourceMetric`. Always set a request
on every container in a Deployment that an HPA targets. (If a Pod has multiple
containers, the request is the sum of their requests; the metric can also be
scoped to one container with `type: ContainerResource`.)

### 5.4 More than one metric

An HPA can watch several metrics at once:

```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target: { type: Utilization, averageUtilization: 50 }
  - type: Resource
    resource:
      name: memory
      target: { type: Utilization, averageUtilization: 70 }
```

The controller computes a desired replica count for **each** metric and takes
the **maximum**. A CPU target of 50% and a memory target of 70% therefore means
"scale for whichever one needs more Pods". Memory is a poor scale-down signal
for most runtimes (heaps do not shrink on demand), which is why CPU is the
default in this lab.

Custom and external metrics (queue depth, requests per second, Kafka lag) work
the same way, but require an adapter that implements the `custom.metrics.k8s.io`
or `external.metrics.k8s.io` API. KEDA is the common choice. That is outside
this lab; the important part is that the HPA algorithm is metric-agnostic.

A CPU or memory HPA never scales below `minReplicas`. `minReplicas: 0` requires
the alpha `HPAScaleToZero` feature gate **and** a custom or external metric -
resource metrics cannot describe a workload that has no Pods to measure. For
true scale-to-zero, use KEDA (or run one small always-on replica).

### 5.5 HPA vs VPA vs cluster autoscaler

| tool | what it changes | reacts to | best for |
|---|---|---|---|
| **HPA** | number of Pods | CPU, memory, custom/external metrics | stateless services with variable request rates |
| **VPA** | CPU/memory requests of a Pod | historical usage | right-sizing requests; usually restarts Pods |
| **Cluster Autoscaler / Karpenter** | number of **nodes** | unschedulable Pods | when the cluster itself is too small |

They compose: an HPA adds Pods, and if those Pods cannot be scheduled, a cluster
autoscaler adds nodes. An HPA cannot fix a cluster that has no capacity, and a
cluster autoscaler cannot fix a workload that has no HPA.

---

## 6. Experiments

Do these after the basic cycle works. Each one changes one variable; note what
the HPA does before you change the next.

### 6.1 Change the target

Lower target -> more replicas for the same load. Higher target -> fewer.

```sh
# aggressive: aim for 25% average utilization
kubectl patch hpa login-screen --type=merge -p \
  '{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":25}}}]}}'

# relaxed: aim for 80%
kubectl patch hpa login-screen --type=merge -p \
  '{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":80}}}]}}'

# back to the lab value
kubectl patch hpa login-screen --type=merge -p \
  '{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":50}}}]}}'
```

With the load generator running, 25% should push toward `maxReplicas`; 80%
should settle at fewer Pods. The HPA does not scale instantly after a patch -
wait for the next sync and for the stabilisation window.

### 6.2 Hit the ceiling

```sh
kubectl patch hpa login-screen --type=merge -p '{"spec":{"maxReplicas":3}}'
kubectl describe hpa login-screen | grep -A3 'ScalingLimited'
```

`ScalingLimited=True`, reason `TooManyReplicas`: the controller wants more than
three, but the policy forbids it. Restore:

```sh
kubectl patch hpa login-screen --type=merge -p '{"spec":{"maxReplicas":10}}'
```

---

## 7. Cleanup

```sh
kubectl delete -f examples/2-load-generator/50-load-generator.yaml --ignore-not-found
kubectl delete -f examples/1-login-screen/ --ignore-not-found

# only if you applied the optional Ingress:
sed "s/<username>/$NS/g" examples/optional-ingress/30-ingress.yaml | kubectl delete -f - --ignore-not-found

kubectl get hpa,deploy,pods
```

Deleting the HPA does **not** delete the Deployment; deleting the Deployment
does not delete the Service or the Ingress. `kubectl delete -f` on the directory
removes the objects that directory created (Deployment, Service, HPA).

Check that your namespace is clean before the next lab:

```sh
kubectl get all
kubectl describe quota
```

---

## 8. Troubleshooting

Useful debugging commands:

```sh
kubectl get hpa login-screen -o yaml
kubectl describe hpa login-screen
kubectl get events --sort-by=.lastTimestamp | tail -30
kubectl top pods -l app.kubernetes.io/name=login-screen
kubectl get endpoints login-screen
kubectl get deploy login-screen -o yaml | grep -A8 resources
kubectl logs deploy/load-generator --tail=20
```

---

## 9. Submission

Simply fork this repository.

---

## 10. Further reading

- Horizontal Pod Autoscaling (concept) - <https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/>
- HPA algorithm details - <https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/#algorithm-details>
- `autoscaling/v2` API reference - <https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/horizontal-pod-autoscaler-v2/>
- metrics-server - <https://github.com/kubernetes-sigs/metrics-server>
- Resource requests and limits - <https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/>
- KEDA (event-driven autoscaling) - <https://keda.sh/docs/latest/>
- Argon2 (RFC 9106) - <https://www.rfc-editor.org/rfc/rfc9106>
- Bun password hashing - <https://bun.sh/docs/api/hashing>
