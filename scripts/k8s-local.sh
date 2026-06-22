#!/usr/bin/env bash
set -euo pipefail

CLUSTER="support-copilot-local"
IMAGE="support-copilot:local"
NS="support-copilot"
OVERLAY="infra/k8s/local"
KIND_CONFIG="${OVERLAY}/kind-cluster.yaml"
ENV_FILE=".env.local"
SECRET="support-copilot-secrets"
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

ensure_namespace_and_secret() {
  echo "==> ensuring namespace + Supabase secret"
  kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
  # The app's data layer is hosted Supabase. Build the Secret from .env.local
  # (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, OPENAI_API_KEY, ...).
  # Never committed; lives only in the cluster.
  kubectl create secret generic "$SECRET" -n "$NS" \
    --from-env-file="$ENV_FILE" \
    --dry-run=client -o yaml | kubectl apply -f -
}

apply() {
  echo "==> applying overlay $OVERLAY"
  kubectl apply -k "$OVERLAY"
}

wait_ready() {
  echo "==> waiting for redis + web + worker"
  kubectl -n "$NS" rollout status deploy/redis --timeout=120s
  kubectl -n "$NS" rollout status deploy/support-copilot-web --timeout=180s
  kubectl -n "$NS" rollout status deploy/support-copilot-worker --timeout=180s
}

cmd_up() {
  require kind; require kubectl; require docker
  [ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found. It must hold the Supabase creds (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, ...)." >&2; exit 1; }
  cluster_up
  build_and_load
  ensure_namespace_and_secret
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
  ensure_namespace_and_secret
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
