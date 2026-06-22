# Local Kubernetes (kind) Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the full Support Copilot stack on a local single-node kind cluster with one command (`make local-up`), reachable at `http://localhost:8080`, reusing the existing `infra/k8s/base` kustomize manifests via a new `local/` overlay.

**Architecture:** A `local/` kustomize overlay layers local-only concerns onto the deployable base: in-cluster `pgvector` Postgres, a shared-uploads PVC (single-node crutch), `mock` AI, a migrate+seed Job, and NodePort access. A `Makefile` → `scripts/k8s-local.sh` runner creates the kind cluster, builds + loads the image, applies the overlay, and waits for readiness. Base stays functionally unchanged (one documenting comment). Validation is `kubectl kustomize` rendering + a real `make local-up` smoke test (curl health → 200).

**Tech Stack:** kind v0.32, kubectl v1.34 (`kubectl kustomize` built-in — no standalone kustomize), Docker, the existing multi-stage Dockerfile (`support-copilot:local`), redis:7-alpine, hosted Supabase, bash + GNU make.

> ⚠️ **Revision 2026-06-22 (implementation outcome):** Tasks 2 & 4 (in-cluster pgvector Postgres + migrate Job) were **removed during execution** — the app is a hosted-Supabase app (REST + service key), so plain in-cluster Postgres can't serve its data layer. What shipped: web/worker point at hosted Supabase via a `support-copilot-secrets` Secret the runner builds from `.env.local` (gitignored); redis/mock-AI/shared-uploads stay; the runner image also copies `demo/`. `DATABASE_URL` (Supabase Postgres conn string) is optional for the validated flows but needed for the small direct-`pg` subset — add it to `.env.local`. See the spec's "Revision 2026-06-22" banner. Tasks 1, 3, 5, 6, 8 stand (with postgres/migrate waits dropped from the runner).

## Global Constraints

- **Packaging is kustomize, single source of truth.** Do not introduce Helm. Do not duplicate base resources into `local/` — reference `../base`.
- **Base stays functionally unchanged** — the only base edit allowed is a documenting comment (Task 8).
- **No Kubernetes Secret committed.** Local config is non-sensitive and lives in a ConfigMap patch.
- **Namespace:** all resources are in `support-copilot` (match base; set `namespace:` in each new manifest).
- **Image:** `support-copilot:local`, `imagePullPolicy: IfNotPresent` (already how base references it). Built from the existing Dockerfile; loaded into kind with `kind load docker-image`.
- **Access:** `web-service` patched to `NodePort` `30080`; kind maps host `8080` → node `30080`. URL is `http://localhost:8080`.
- **Local config values (exact):** `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/support_copilot`, `AI_PROVIDER=mock`, `DEBUG_MODE=true`, `APP_URL=http://localhost:8080`.
- **Postgres:** `pgvector/pgvector:pg16`, db `support_copilot`, user/pass `postgres`/`postgres`, 1Gi PVC (kind default `local-path` storageclass — no `storageClassName`).
- **Migrate Job:** name `support-copilot-migrate`, runs `npm run db:migrate && npm run seed:demo`, self-gated by an initContainer waiting on Postgres, mounts the shared uploads PVC. Jobs are immutable — the runner deletes it before re-apply.
- **Shared uploads:** a single RWO PVC named `uploads`, mounted at `/app/uploads` on web, worker, and the migrate Job. **Local overlay only** — base must not gain this volume.
- **kind cluster name:** `support-copilot-local`.
- **Validation per manifest task:** `kubectl kustomize infra/k8s/local` renders exit 0, and `kubectl kustomize infra/k8s/local | kubectl apply --dry-run=client -f -` passes (client-side schema check, no cluster needed).
- **Commits:** conventional commits, end body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Stage specific files, never `git add -A`.

---

## File Structure

**New files:**
- `infra/k8s/local/kustomization.yaml` — overlay: `resources: ../base` + the local manifests; `patches:` listing the patch files below (no `target` — each patch is matched by its own apiVersion/kind/name).
- `infra/k8s/local/patch-config.yaml` — strategic-merge patch: ConfigMap `support-copilot-config` data additions (DATABASE_URL, AI_PROVIDER=mock, DEBUG_MODE, APP_URL).
- `infra/k8s/local/patch-web-service.yaml` — strategic-merge patch: Service `support-copilot-web` → NodePort 30080.
- `infra/k8s/local/patch-web-uploads.yaml`, `patch-worker-uploads.yaml` — strategic-merge patches: web/worker Deployments → shared uploads volume + mount.
- `infra/k8s/local/postgres-pvc.yaml`, `postgres-deployment.yaml`, `postgres-service.yaml` — in-cluster pgvector.
- `infra/k8s/local/uploads-pvc.yaml` — shared uploads PVC.
- `infra/k8s/local/migrate-job.yaml` — migrate+seed Job.
- `infra/k8s/local/kind-cluster.yaml` — 1-node kind cluster with host:8080 → node:30080 port map.
- `scripts/k8s-local.sh` — runner logic (up/down/redeploy/logs).
- `Makefile` — thin targets delegating to the runner.

**Modified files:**
- `scripts/check-k8s-manifests.mjs` — also render `infra/k8s/local` (Task 8).
- `infra/k8s/base/worker-deployment.yaml` — documenting comment only (Task 8).

---

## Task 0: Branch off main

- [ ] **Step 1: Create the working branch**

Run: `git switch -c local-kind-k8s`
Expected: on a clean branch `local-kind-k8s` off current `main` (`git status` clean).

---

## Task 1: Local overlay skeleton — config + service patches

Creates the overlay that references base and patches the ConfigMap (local env) and the web Service (NodePort). This is the first renderable unit.

**Files:**
- Create: `infra/k8s/local/kustomization.yaml`
- Create: `infra/k8s/local/patch-config.yaml`
- Create: `infra/k8s/local/patch-web-service.yaml`

**Interfaces:**
- Produces: a renderable overlay at `infra/k8s/local`; ConfigMap `support-copilot-config` gains `DATABASE_URL`, `AI_PROVIDER=mock`, `DEBUG_MODE=true`, `APP_URL`; Service `support-copilot-web` becomes `NodePort` `30080`.

- [ ] **Step 1: Create `infra/k8s/local/kustomization.yaml`**

Each `patches` entry references a single-document strategic-merge patch and carries **no `target`** — kustomize matches each patch to the base resource with the same apiVersion/kind/name.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Local kind overlay. Layers local-only concerns onto the deployable base.
# Do not duplicate base resources here — only add local-specific ones.
resources:
  - ../base

patches:
  - path: patch-config.yaml
  - path: patch-web-service.yaml
```

- [ ] **Step 2: Create `infra/k8s/local/patch-config.yaml`**

```yaml
# Local-only, non-sensitive env. No Secret is created for local.
apiVersion: v1
kind: ConfigMap
metadata:
  name: support-copilot-config
  namespace: support-copilot
data:
  DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/support_copilot"
  AI_PROVIDER: "mock"
  DEBUG_MODE: "true"
  APP_URL: "http://localhost:8080"
```

- [ ] **Step 2b: Create `infra/k8s/local/patch-web-service.yaml`**

```yaml
# Expose web on a stable NodePort that kind maps to host :8080.
apiVersion: v1
kind: Service
metadata:
  name: support-copilot-web
  namespace: support-copilot
spec:
  type: NodePort
  ports:
    - name: http
      port: 3000
      targetPort: http
      nodePort: 30080
```

- [ ] **Step 3: Render and assert**

Run:
```bash
kubectl kustomize infra/k8s/local > /tmp/local-render.yaml && echo "RENDER OK"
grep -E 'AI_PROVIDER: "?mock|nodePort: 30080|DATABASE_URL' /tmp/local-render.yaml
```
Expected: `RENDER OK`, and the grep shows `AI_PROVIDER: mock`, `nodePort: 30080`, and the `DATABASE_URL` line. (Kustomize merges the ConfigMap data onto the base config — confirm `AI_PROVIDER` is now `mock`, not the base's `openai`.)

- [ ] **Step 4: Client-side schema validation**

Run: `kubectl kustomize infra/k8s/local | kubectl apply --dry-run=client -f - 2>&1 | tail -8`
Expected: every resource prints `... (dry run)` with no error.

- [ ] **Step 5: Commit**

```bash
git add infra/k8s/local/kustomization.yaml infra/k8s/local/patch-config.yaml infra/k8s/local/patch-web-service.yaml
git commit -m "$(printf 'feat(k8s): local overlay skeleton with mock-ai config and nodeport\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: In-cluster pgvector Postgres

**Files:**
- Create: `infra/k8s/local/postgres-pvc.yaml`
- Create: `infra/k8s/local/postgres-deployment.yaml`
- Create: `infra/k8s/local/postgres-service.yaml`
- Modify: `infra/k8s/local/kustomization.yaml` (add the three to `resources`)

**Interfaces:**
- Produces: Service `postgres` (ClusterIP, port 5432) backing `DATABASE_URL` from Task 1; Deployment `postgres` (label `app.kubernetes.io/name: postgres`); PVC `postgres-data`.

- [ ] **Step 1: Create `infra/k8s/local/postgres-pvc.yaml`**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: support-copilot
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

- [ ] **Step 2: Create `infra/k8s/local/postgres-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: support-copilot
  labels:
    app.kubernetes.io/name: postgres
spec:
  selector:
    app.kubernetes.io/name: postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
```

- [ ] **Step 3: Create `infra/k8s/local/postgres-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: support-copilot
  labels:
    app.kubernetes.io/name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: postgres
  template:
    metadata:
      labels:
        app.kubernetes.io/name: postgres
    spec:
      containers:
        - name: postgres
          image: pgvector/pgvector:pg16
          env:
            - name: POSTGRES_USER
              value: postgres
            - name: POSTGRES_PASSWORD
              value: postgres
            - name: POSTGRES_DB
              value: support_copilot
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          ports:
            - name: postgres
              containerPort: 5432
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "postgres", "-d", "support_copilot"]
            initialDelaySeconds: 5
            periodSeconds: 5
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "postgres", "-d", "support_copilot"]
            initialDelaySeconds: 15
            periodSeconds: 10
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-data
```

- [ ] **Step 4: Add to `infra/k8s/local/kustomization.yaml` resources**

Change the `resources:` list to:
```yaml
resources:
  - ../base
  - postgres-pvc.yaml
  - postgres-service.yaml
  - postgres-deployment.yaml
```

- [ ] **Step 5: Render + dry-run assert**

Run:
```bash
kubectl kustomize infra/k8s/local > /tmp/local-render.yaml && echo "RENDER OK"
grep -E 'pgvector/pgvector:pg16|name: postgres' /tmp/local-render.yaml | head
kubectl kustomize infra/k8s/local | kubectl apply --dry-run=client -f - 2>&1 | grep -iE 'error' || echo "DRY-RUN CLEAN"
```
Expected: `RENDER OK`, grep shows the pgvector image and the postgres Service/Deployment, `DRY-RUN CLEAN`.

- [ ] **Step 6: Commit**

```bash
git add infra/k8s/local/postgres-pvc.yaml infra/k8s/local/postgres-service.yaml infra/k8s/local/postgres-deployment.yaml infra/k8s/local/kustomization.yaml
git commit -m "$(printf 'feat(k8s): in-cluster pgvector postgres for local overlay\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Shared uploads PVC + web/worker volume patches

Web and worker must share upload artifacts (web writes via `localObjectStorage`, the worker reads by `storagePath`). On single-node kind a shared RWO PVC works.

**Files:**
- Create: `infra/k8s/local/uploads-pvc.yaml`
- Create: `infra/k8s/local/patch-web-uploads.yaml`
- Create: `infra/k8s/local/patch-worker-uploads.yaml`
- Modify: `infra/k8s/local/kustomization.yaml` (add the PVC to resources; add the two patch files)

**Interfaces:**
- Produces: PVC `uploads`; web and worker pods mount it at `/app/uploads`.

- [ ] **Step 1: Create `infra/k8s/local/uploads-pvc.yaml`**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads
  namespace: support-copilot
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

- [ ] **Step 2: Create `infra/k8s/local/patch-web-uploads.yaml`**

```yaml
# Web: mount the shared uploads PVC (local single-node only).
apiVersion: apps/v1
kind: Deployment
metadata:
  name: support-copilot-web
  namespace: support-copilot
spec:
  template:
    spec:
      containers:
        - name: web
          volumeMounts:
            - name: uploads
              mountPath: /app/uploads
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: uploads
```

- [ ] **Step 2b: Create `infra/k8s/local/patch-worker-uploads.yaml`**

```yaml
# Worker: mount the same shared uploads PVC so ingestion can read web's writes.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: support-copilot-worker
  namespace: support-copilot
spec:
  template:
    spec:
      containers:
        - name: worker
          volumeMounts:
            - name: uploads
              mountPath: /app/uploads
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: uploads
```

- [ ] **Step 3: Update `infra/k8s/local/kustomization.yaml`**

Add the uploads PVC to `resources` and the two patch files to `patches`. Full file:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Local kind overlay. Layers local-only concerns onto the deployable base.
# Do not duplicate base resources here — only add local-specific ones.
resources:
  - ../base
  - postgres-pvc.yaml
  - postgres-service.yaml
  - postgres-deployment.yaml
  - uploads-pvc.yaml

patches:
  - path: patch-config.yaml
  - path: patch-web-service.yaml
  - path: patch-web-uploads.yaml
  - path: patch-worker-uploads.yaml
```

- [ ] **Step 4: Render + assert the mounts apply to BOTH deployments**

Run:
```bash
kubectl kustomize infra/k8s/local > /tmp/local-render.yaml && echo "RENDER OK"
grep -c 'mountPath: /app/uploads' /tmp/local-render.yaml
kubectl kustomize infra/k8s/local | kubectl apply --dry-run=client -f - 2>&1 | grep -iE 'error' || echo "DRY-RUN CLEAN"
```
Expected: `RENDER OK`, the mount count is `2` (web + worker), `DRY-RUN CLEAN`.

- [ ] **Step 5: Commit**

```bash
git add infra/k8s/local/uploads-pvc.yaml infra/k8s/local/patch-web-uploads.yaml infra/k8s/local/patch-worker-uploads.yaml infra/k8s/local/kustomization.yaml
git commit -m "$(printf 'feat(k8s): shared uploads pvc for web and worker (local only)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Migrate + seed Job

**Files:**
- Create: `infra/k8s/local/migrate-job.yaml`
- Modify: `infra/k8s/local/kustomization.yaml` (add to resources)

**Interfaces:**
- Produces: Job `support-copilot-migrate` that runs migrations + seed against in-cluster Postgres, self-gated by an initContainer, mounting the `uploads` PVC.

- [ ] **Step 1: Create `infra/k8s/local/migrate-job.yaml`**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: support-copilot-migrate
  namespace: support-copilot
spec:
  backoffLimit: 3
  template:
    metadata:
      labels:
        app.kubernetes.io/name: support-copilot
        app.kubernetes.io/component: migrate
    spec:
      restartPolicy: Never
      initContainers:
        - name: wait-for-postgres
          image: postgres:16-alpine
          command:
            - sh
            - -c
            - "until pg_isready -h postgres -U postgres; do echo 'waiting for postgres'; sleep 2; done"
      containers:
        - name: migrate
          image: support-copilot:local
          imagePullPolicy: IfNotPresent
          command:
            - sh
            - -c
            - "npm run db:migrate && npm run seed:demo"
          envFrom:
            - configMapRef:
                name: support-copilot-config
            - secretRef:
                name: support-copilot-secrets
                optional: true
          volumeMounts:
            - name: uploads
              mountPath: /app/uploads
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: uploads
```

- [ ] **Step 2: Add to `infra/k8s/local/kustomization.yaml` resources**

Append `migrate-job.yaml` to the `resources` list (after `uploads-pvc.yaml`).

- [ ] **Step 3: Render + assert**

Run:
```bash
kubectl kustomize infra/k8s/local > /tmp/local-render.yaml && echo "RENDER OK"
grep -E 'support-copilot-migrate|wait-for-postgres|db:migrate' /tmp/local-render.yaml | head
kubectl kustomize infra/k8s/local | kubectl apply --dry-run=client -f - 2>&1 | grep -iE 'error' || echo "DRY-RUN CLEAN"
```
Expected: `RENDER OK`, grep shows the Job name, the initContainer, and the migrate command; `DRY-RUN CLEAN`.

- [ ] **Step 4: Commit**

```bash
git add infra/k8s/local/migrate-job.yaml infra/k8s/local/kustomization.yaml
git commit -m "$(printf 'feat(k8s): migrate and seed job for local overlay\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: kind cluster config

**Files:**
- Create: `infra/k8s/local/kind-cluster.yaml`

- [ ] **Step 1: Create `infra/k8s/local/kind-cluster.yaml`**

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: support-copilot-local
nodes:
  - role: control-plane
    extraPortMappings:
      # host :8080 -> NodePort :30080 (web service)
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
```

- [ ] **Step 2: Validate the kind config parses (dry, no cluster created)**

Run: `kind create cluster --name support-copilot-local --config infra/k8s/local/kind-cluster.yaml --retain --kubeconfig /tmp/kc-validate 2>&1 | tail -3; kind delete cluster --name support-copilot-local 2>&1 | tail -1`
Expected: cluster creates without a config parse error, then deletes. (If the environment cannot create clusters, instead run `kind create cluster --help >/dev/null && echo "kind present"` and rely on Task 6's full run.)

- [ ] **Step 3: Commit**

```bash
git add infra/k8s/local/kind-cluster.yaml
git commit -m "$(printf 'feat(k8s): kind cluster config mapping host 8080 to web nodeport\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Runner — Makefile + k8s-local.sh (end-to-end smoke test)

This is the integration task: `make local-up` brings the whole stack up and serves `http://localhost:8080`.

**Files:**
- Create: `scripts/k8s-local.sh`
- Create: `Makefile`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `make local-up`, `make local-down`, `make local-redeploy`, `make local-logs`.

- [ ] **Step 1: Create `scripts/k8s-local.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

CLUSTER="support-copilot-local"
IMAGE="support-copilot:local"
NS="support-copilot"
OVERLAY="infra/k8s/local"
KIND_CONFIG="${OVERLAY}/kind-cluster.yaml"
URL="http://localhost:8080"

require() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required but not installed." >&2; exit 1; }; }

cluster_up() {
  if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
    echo "==> kind cluster '$CLUSTER' already exists"
  else
    echo "==> creating kind cluster '$CLUSTER'"
    kind create cluster --name "$CLUSTER" --config "$KIND_CONFIG"
  fi
}

build_and_load() {
  echo "==> building image $IMAGE"
  docker build -t "$IMAGE" .
  echo "==> loading image into kind"
  kind load docker-image "$IMAGE" --name "$CLUSTER"
}

apply() {
  echo "==> applying overlay $OVERLAY"
  # Jobs are immutable; recreate the migrate job on each up.
  kubectl delete job support-copilot-migrate -n "$NS" --ignore-not-found
  kubectl apply -k "$OVERLAY"
}

wait_ready() {
  echo "==> waiting for postgres"
  kubectl -n "$NS" rollout status deploy/postgres --timeout=120s
  echo "==> waiting for migrate+seed job"
  kubectl -n "$NS" wait --for=condition=complete job/support-copilot-migrate --timeout=180s
  echo "==> waiting for web + worker"
  kubectl -n "$NS" rollout status deploy/support-copilot-web --timeout=180s
  kubectl -n "$NS" rollout status deploy/support-copilot-worker --timeout=180s
}

cmd_up() {
  require kind; require kubectl; require docker
  cluster_up
  build_and_load
  apply
  wait_ready
  echo ""
  echo "==> Support Copilot is up at ${URL}"
  echo "    health: curl -s ${URL}/api/health"
}

cmd_down() {
  require kind
  echo "==> deleting kind cluster '$CLUSTER'"
  kind delete cluster --name "$CLUSTER"
}

cmd_redeploy() {
  require kind; require kubectl; require docker
  build_and_load
  kubectl -n "$NS" rollout restart deploy/support-copilot-web deploy/support-copilot-worker
  kubectl -n "$NS" rollout status deploy/support-copilot-web --timeout=180s
  kubectl -n "$NS" rollout status deploy/support-copilot-worker --timeout=180s
  echo "==> redeployed at ${URL}"
}

cmd_logs() {
  require kubectl
  kubectl -n "$NS" logs -l app.kubernetes.io/name=support-copilot --all-containers --tail=100 -f
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  redeploy) cmd_redeploy ;;
  logs) cmd_logs ;;
  *) echo "usage: $0 {up|down|redeploy|logs}" >&2; exit 2 ;;
esac
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/k8s-local.sh`

- [ ] **Step 3: Create `Makefile`**

```makefile
.PHONY: local-up local-down local-redeploy local-logs

local-up: ## Create kind cluster, build+load image, deploy local overlay
	./scripts/k8s-local.sh up

local-down: ## Delete the local kind cluster
	./scripts/k8s-local.sh down

local-redeploy: ## Rebuild image and restart web+worker (no cluster recreate)
	./scripts/k8s-local.sh redeploy

local-logs: ## Tail web+worker logs
	./scripts/k8s-local.sh logs
```

> Makefile recipes must be TAB-indented, not spaces.

- [ ] **Step 4: End-to-end smoke test**

Run:
```bash
make local-up
```
Expected: completes through "Support Copilot is up at http://localhost:8080" with postgres rollout, migrate job complete, and web+worker rollouts all succeeding.

Then:
```bash
curl -s -o /dev/null -w 'health -> %{http_code}\n' http://localhost:8080/api/health
curl -s -o /dev/null -w 'home   -> %{http_code}\n' http://localhost:8080/
```
Expected: both `200`.

- [ ] **Step 5: Verify ingestion works end-to-end (shared uploads + worker + pgvector + mock AI)**

Run:
```bash
kubectl -n support-copilot logs job/support-copilot-migrate | tail -5
kubectl -n support-copilot get pods
```
Expected: the migrate job log shows seed completion; all pods `Running`/`Completed`. (Optional manual: open `http://localhost:8080`, confirm the seeded sample doc is present and a demo ticket returns a grounded mock answer.)

- [ ] **Step 6: Commit**

```bash
git add scripts/k8s-local.sh Makefile
git commit -m "$(printf 'feat(k8s): make local-up runner for kind stack\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Idempotency + teardown check

Confirms re-running and tearing down behave (the runner's `--ignore-not-found` job delete + cluster-exists guard).

**Files:** none (validation only; fixes go to `scripts/k8s-local.sh` if found).

- [ ] **Step 1: Re-run `make local-up` (idempotent)**

Run: `make local-up`
Expected: reports the cluster already exists, recreates the migrate job, re-applies cleanly, ends "up at http://localhost:8080". No error about the immutable Job.

- [ ] **Step 2: Teardown**

Run: `make local-down && kind get clusters 2>&1 | grep -q support-copilot-local && echo "STILL PRESENT" || echo "CLUSTER GONE"`
Expected: `CLUSTER GONE`.

- [ ] **Step 3: If either failed, fix `scripts/k8s-local.sh` and re-verify, then commit the fix**

```bash
git add scripts/k8s-local.sh
git commit -m "$(printf 'fix(k8s): harden local runner idempotency/teardown\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```
(If no fix was needed, skip the commit.)

---

## Task 8: Base documenting comment + extend check:k8s

**Files:**
- Modify: `infra/k8s/base/worker-deployment.yaml` (comment only)
- Modify: `scripts/check-k8s-manifests.mjs` (also render the local overlay)

- [ ] **Step 1: Add the documenting comment to `infra/k8s/base/worker-deployment.yaml`**

Insert at the very top of the file (above `apiVersion:`):
```yaml
# NOTE: web and worker must share upload artifacts — web writes uploads via
# src/server/storage/localObjectStorage.ts and the ingestion worker reads them
# by storagePath. The local kind overlay (infra/k8s/local) solves this with a
# shared ReadWriteOnce PVC, which only works on a single node. Production must
# back localObjectStorage with object storage (S3/GCS) or an RWX volume — do
# not rely on a shared filesystem on a multi-node cluster.
```

- [ ] **Step 2: Extend `scripts/check-k8s-manifests.mjs` to render both base and the local overlay**

Replace the file body with:
```js
import { spawnSync } from "node:child_process";

const targets = ["infra/k8s/base", "infra/k8s/local"];

for (const target of targets) {
  const result = spawnSync("kubectl", ["kustomize", target], { encoding: "utf8" });

  if (result.stdout && process.env.VERBOSE_K8S_CHECK === "true") {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    console.error(`Failed to render ${target}`);
    process.exit(result.status ?? 1);
  }
  console.log(`Rendered ${target} successfully.`);
}

console.log("Kubernetes manifests rendered successfully.");
```

- [ ] **Step 3: Run check:k8s**

Run: `npm run check:k8s`
Expected: prints "Rendered infra/k8s/base successfully.", "Rendered infra/k8s/local successfully.", then the final success line; exit 0.

- [ ] **Step 4: Confirm base is otherwise functionally unchanged**

Run: `git diff infra/k8s/base | grep -E '^\+' | grep -vE '^\+#|^\+\+\+'`
Expected: no output (the only added lines in base are comment lines).

- [ ] **Step 5: Commit**

```bash
git add infra/k8s/base/worker-deployment.yaml scripts/check-k8s-manifests.mjs
git commit -m "$(printf 'docs(k8s): document shared-uploads requirement; check local overlay\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Notes for the implementer

- **`kubectl kustomize` is the renderer** (no standalone `kustomize` binary needed). `npm run check:k8s` uses it.
- **Heavy tasks:** Task 6 builds the image (~90s: `npm ci` ~58s + `npm run build`) and creates a cluster. Budget a few minutes; it is the real validation of the whole overlay.
- **Web/worker crash-looping briefly before migrations complete is expected** — they restart until the schema exists; the runner waits on the migrate Job before asserting web/worker rollout, so `make local-up` still converges. Do not add app-side migration retries to "fix" this.
- **If `kubectl apply -k` errors on the migrate Job during re-apply**, that is the immutability issue — confirm the runner's `kubectl delete job ... --ignore-not-found` runs before `apply` (Task 6 Step 1).
- **Image pull:** base uses `IfNotPresent` and the image is side-loaded via `kind load`, so the cluster never reaches a registry for `support-copilot:local`. If a pod shows `ErrImageNeverPull`/`ImagePullBackOff`, the `kind load` step did not run or used the wrong tag.
- **Do not introduce Helm or a standalone kustomize dependency** — kustomize stays the single source of truth, rendered by `kubectl`.
