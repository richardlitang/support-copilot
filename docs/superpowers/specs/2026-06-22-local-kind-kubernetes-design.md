# Local Kubernetes (kind) Run — Design Spec

**Date:** 2026-06-22
**Status:** Approved design, ready for implementation planning
**Scope:** Run the app locally on a kind cluster from the existing kustomize manifests, while keeping `infra/k8s/base` a clean, honest deploy target. Production/cloud deploy (registry, ingress/TLS, managed DB, Argo CD, object storage) is explicitly a **separate, later** effort.

---

## 1. Goal

Let a developer run the full Support Copilot stack on a local single-node **kind** cluster with **one command** (`make local-up`), reaching it at `http://localhost:8080`. The local setup must reuse the existing `infra/k8s/base` manifests (deploy-parity, since the real goal is deploying to an actual cluster) and add only local-specific concerns in a `local/` overlay. The base must stay genuinely deployable and must not absorb local-only mechanisms.

Settled decisions (from brainstorming):
1. **Cluster tool:** kind (single node).
2. **Loop:** kustomize overlay + a `Makefile`/script runner. No Tilt/Skaffold, no extra daemons.
3. **Scope:** local-runnable now; base stays deploy-ready; prod overlay deferred.
4. **AI provider:** `mock` locally (no OpenAI key, deterministic, matches offline evals).
5. **Storage sharing:** the shared-uploads PVC is a **local-only** mechanism in the overlay; base only documents the requirement.

## 2. Current state (from the repo)

- `infra/k8s/base/` is a kustomize base: `namespace`, `configmap`, `redis` (deploy+svc), `web` (deploy `npm run start`, port 3000, health probes on `/api/health`), `worker` (deploy `npm run worker:start`). Both app deployments use image `support-copilot:local` with `imagePullPolicy: IfNotPresent` and `envFrom` configmap + an **optional** secret.
- **Gaps for local run:**
  - **No Postgres.** `DATABASE_URL` is expected from the (external) secret. The app needs **pgvector** specifically (`pgvector/pgvector:pg16`, per `docker-compose.yml`).
  - `AI_PROVIDER: openai` in the configmap (needs a key); local wants `mock`.
  - **No shared upload storage.** Confirmed data flow: `src/server/storage/localObjectStorage.ts` writes upload bytes to disk and records `storagePath`; `src/server/queue/workers/documentIngestionWorker.ts` calls `getLocalObject(document.storagePath)` — the **worker reads from disk what the web wrote**. Separate per-pod `/app/uploads` ⇒ ingestion silently breaks.
  - No local access path (services are ClusterIP).
- The Dockerfile already builds a working production image (validated: `npm ci` + `npm run build`, image `support-copilot:*` runs web `GET / 200` and worker `worker_ready`).

## 3. Architecture

Base stays the deploy target; all local-only concerns live in `infra/k8s/local/`.

```
infra/k8s/
  base/                          # deploy target — only change is a documenting comment (see §6)
  local/
    kustomization.yaml           # resources: ../base + postgres + uploads-pvc; patches; image pin
    kind-cluster.yaml            # 1-node kind; host :8080 -> node :30080
    postgres-deployment.yaml     # pgvector/pgvector:pg16 + PVC mount
    postgres-pvc.yaml            # 1Gi RWO (kind local-path storageclass)
    postgres-service.yaml        # ClusterIP "postgres"
    uploads-pvc.yaml             # 1Gi RWO, shared by web + worker (+ migrate job)
    migrate-job.yaml             # one-shot: db:migrate && seed:demo
    patches.yaml                 # configmap + web-service + uploads-volume patches
Makefile                         # local-up / local-down / local-redeploy / local-logs
scripts/k8s-local.sh             # the runner logic the Makefile delegates to
```

**Access:** `web-service` patched to `NodePort` `30080`; `kind-cluster.yaml` maps host `8080` → node `30080`. Open `http://localhost:8080` directly — no `kubectl port-forward` process.

## 4. Local environment specifics

### Postgres (the gap)
- `pgvector/pgvector:pg16` Deployment, env `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=support_copilot`. Readiness/liveness via `pg_isready -U postgres -d support_copilot`.
- `postgres-pvc.yaml`: 1Gi RWO on kind's default `local-path` storageclass, mounted at `/var/lib/postgresql/data` so data survives pod restarts.
- `postgres-service.yaml`: ClusterIP named `postgres`, port 5432.

### Config (no secret needed locally)
The base secret is already `optional: true`. Local non-sensitive values go into a **configmap patch** in `patches.yaml` (merged onto `support-copilot-config`):
- `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/support_copilot`
- `AI_PROVIDER=mock`
- `DEBUG_MODE=true`
- `APP_URL=http://localhost:8080`

No Kubernetes Secret is created for local; nothing sensitive is committed.

### Migrations + seed (Job)
- `migrate-job.yaml`: a one-shot `Job` named `support-copilot-migrate` using `image: support-copilot:local`, `restartPolicy: Never`, `backoffLimit: 3`, `envFrom` the same configmap. Command: `sh -c "npm run db:migrate && npm run seed:demo"`.
- It mounts the shared **uploads PVC** at `/app/uploads` (so any seed-time ingestion artifacts land where the worker can read them).
- It is **self-gating**: an `initContainer` (e.g. `postgres:16-alpine` running `until pg_isready -h postgres -U postgres; do sleep 2; done`) blocks the migrate container until Postgres accepts connections, so the Job never burns its `backoffLimit` racing a not-yet-ready database. Apply order is therefore not load-bearing. (`db:migrate` is idempotent; `seed:demo` is the canonical demo seed.)

### Shared uploads (local-only mechanism)
- `uploads-pvc.yaml`: 1Gi RWO. On single-node kind, both web and worker pods schedule on the one node and can mount the same RWO PVC, so they share `/app/uploads`.
- A patch in `patches.yaml` adds this volume + `volumeMount` at `/app/uploads` to **web**, **worker**, and the **migrate Job**.
- This lives **only in the overlay**. Base is unchanged except for a comment (see §6). Rationale: a shared RWO PVC does not work on real multi-node clusters; the correct production fix is an object-storage backend behind the existing `localObjectStorage` seam (S3/GCS), which is part of the deferred prod effort.

### AI = mock
`AI_PROVIDER=mock` ⇒ no OpenAI key, deterministic answers (same as `eval:rag-contract`), so the whole UI (pipeline reveal, exhibits, cited answers, review states) is exercisable locally.

## 5. The runner

A root **`Makefile`** is the friendly entrypoint; logic lives in `scripts/k8s-local.sh` (so the behavior is testable and the Make targets stay thin).

- **`make local-up`** → `k8s-local.sh up`:
  1. Create kind cluster `support-copilot-local` from `kind-cluster.yaml` if it does not already exist (idempotent).
  2. `docker build -t support-copilot:local .`
  3. `kind load docker-image support-copilot:local --name support-copilot-local`
  4. `kubectl delete job support-copilot-migrate -n support-copilot --ignore-not-found` (Jobs are immutable; this makes re-running `local-up` idempotent), then `kubectl apply -k infra/k8s/local`
  5. `kubectl -n support-copilot rollout status deploy/postgres` (wait ready)
  6. `kubectl -n support-copilot wait --for=condition=complete job/support-copilot-migrate --timeout=180s`
  7. `kubectl -n support-copilot rollout status deploy/support-copilot-web deploy/support-copilot-worker`
  8. Print `→ http://localhost:8080`.
- **`make local-down`** → delete the kind cluster (full teardown).
- **`make local-redeploy`** → build → `kind load` → `kubectl -n support-copilot rollout restart deploy/support-copilot-web deploy/support-copilot-worker` (fast iteration without recreating the cluster).
- **`make local-logs`** → tail web + worker logs.

`scripts/k8s-local.sh` validates prerequisites (`kind`, `kubectl`, `docker`) with a clear message if missing, and uses `set -euo pipefail`.

## 6. The one base change

`infra/k8s/base` gets **no functional change** — only a comment (in `worker-deployment.yaml` and/or `web-deployment.yaml`, or a short `base/README.md`) documenting:

> web and worker must share upload artifacts (`localObjectStorage` writes on web, the ingestion worker reads by `storagePath`). The local overlay solves this with a shared RWO PVC (single-node only). Production must back `localObjectStorage` with object storage (S3/GCS) or an RWX volume — do not rely on a shared filesystem on multi-node clusters.

This keeps base honest: it states the requirement without shipping a single-node-only mechanism.

## 7. Constraints

- **Reuse `base` via the overlay**; do not duplicate base resources into `local/`.
- **No secret committed**; local config is non-sensitive and lives in the configmap patch.
- **Base stays deployable and functionally unchanged** (comment only).
- **Single-node assumptions are confined to the overlay** (shared RWO PVC, NodePort+extraPortMapping, single replicas).
- `kustomize build infra/k8s/local` must render cleanly (wire into `check:k8s` if practical).
- The image is the existing Dockerfile output (`support-copilot:local`); no new build path.

## 8. Verification

- `kubectl kustomize infra/k8s/local` (and `npm run check:k8s` if it can target the overlay) renders without error.
- `make local-up` completes and ends with:
  - `curl -s http://localhost:8080/api/health` → `200`.
  - `curl -s http://localhost:8080/` → `200` (web compiled/served).
  - The seeded sample document is present and an investigation against a demo ticket returns a grounded (mock) answer — proving Postgres (pgvector), redis, worker ingestion (shared uploads), and the mock AI path all work end-to-end in-cluster.
- `make local-down` removes the cluster cleanly.

## 9. Out of scope (YAGNI / deferred)

- Cloud/production overlay: image registry, ingress + TLS, managed Postgres, Argo CD application, production secret management, HPA/replicas, resource requests/limits tuning.
- Object-storage backend for `localObjectStorage` (the real multi-node uploads fix) — an app change for the prod effort.
- Tilt/Skaffold or any live-reload inner loop.
- Multi-node kind or production-grade storage classes.
