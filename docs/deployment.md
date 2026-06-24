# Deployment Notes

This project currently has a raw Kubernetes base for learning the deployment shape before introducing Helm, Terraform, or Argo CD.

## Local Kubernetes With kind

`kind` runs a local Kubernetes cluster inside Docker. In the default setup, the cluster is one Docker container that acts as the Kubernetes node. `kubectl` then talks to that cluster through the `kind-support-copilot` context.

The raw manifests live in `infra/k8s/base` and create:

- Namespace: `support-copilot`
- Deployments: `support-copilot-web`, `support-copilot-worker`, `redis`
- Services: `support-copilot-web`, `redis`
- ConfigMap: `support-copilot-config`

The web and worker use the same image:

- Web command: `npm run start`
- Worker command: `npm run worker:start`

Redis is included only for local learning and development. A managed Redis service is the preferred production direction.

## Run The Raw Manifests Locally

Create the kind cluster:

```bash
kind create cluster --name support-copilot
```

Build the app image:

```bash
docker build -t support-copilot:local .
```

Load the image into the kind node:

```bash
kind load docker-image support-copilot:local --name support-copilot
```

Apply the Kubernetes base:

```bash
kubectl apply -k infra/k8s/base
```

Inspect the app resources:

```bash
kubectl get all -n support-copilot
kubectl get pods -n support-copilot
```

Check the worker:

```bash
kubectl logs -n support-copilot deploy/support-copilot-worker
```

The worker may log temporary Redis connection errors while Redis is still starting. The useful success signal is:

```text
worker_ready
```

Forward the web Service to your Mac:

```bash
kubectl port-forward -n support-copilot service/support-copilot-web 3000:3000
```

Leave that command running, then test from another terminal:

```bash
curl http://localhost:3000/api/health
```

Expected result:

```json
{ "status": "ok", "timestamp": "..." }
```

## What This Proves

With just kind, the app is technically running inside Kubernetes:

- Kubernetes can start the web Deployment.
- Kubernetes can start the worker Deployment.
- The web Service can route to the web Pod.
- `kubectl port-forward` can expose the web Service on your Mac.
- `/api/health` confirms the web process is alive.

This does not prove the full product workflow is ready. The health endpoint does not check every dependency. Full upload and investigation flows depend on the configured database and secrets.

For dependency readiness, use:

```bash
curl http://localhost:3000/api/ready
```

In the current raw local manifests, Redis is provided in-cluster and `AI_PROVIDER` is set to `mock`. Database credentials are intentionally not committed. If a Kubernetes workflow needs a real database, create a local Secret based on `infra/k8s/base/support-copilot-secrets.example.yaml` without committing real secret values.

## Run With Helm

Helm packages the same Kubernetes object model behind a chart and a `values.yaml` file. In this repo, the chart lives at:

```text
infra/helm/support-copilot
```

The first chart intentionally keeps the same local behavior as the raw manifests:

- Same namespace: `support-copilot`
- Same app image: `support-copilot:local`
- Same web command: `npm run start`
- Same worker command: `npm run worker:start`
- Same local Redis Deployment and Service
- Same mock AI provider and in-cluster Redis URL

Validate the chart:

```bash
helm lint infra/helm/support-copilot
helm template support-copilot infra/helm/support-copilot --namespace support-copilot
```

If the raw manifests are currently applied, remove the raw resources before installing the Helm release. Helm needs to own the objects it creates.

```bash
kubectl delete deployment/support-copilot-web deployment/support-copilot-worker deployment/redis \
  service/support-copilot-web service/redis configmap/support-copilot-config \
  -n support-copilot
```

Install or update the Helm release:

```bash
helm upgrade --install support-copilot infra/helm/support-copilot \
  --namespace support-copilot \
  --create-namespace
```

Inspect the release:

```bash
helm list -n support-copilot
helm status support-copilot -n support-copilot
kubectl get all -n support-copilot
```

Test the web Service the same way as the raw manifests:

```bash
kubectl port-forward -n support-copilot service/support-copilot-web 3000:3000
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Uninstall the Helm release:

```bash
helm uninstall support-copilot -n support-copilot
```

## Deploy To One DigitalOcean Droplet

The cheapest practical public deployment path is one Droplet running Docker Compose:

- Caddy terminates HTTPS and reverse-proxies to the app.
- The app runs from the production Docker image.
- The worker runs from the same production Docker image.
- Redis runs as a local container with an append-only volume.
- Postgres should be external, such as hosted Supabase Postgres, through `DATABASE_URL`.

This is simpler and cheaper than production Kubernetes for the first public demo.

### Droplet Setup

Use Ubuntu 24.04 LTS or a current Docker-ready Ubuntu image. A 1 vCPU / 2 GB RAM Droplet is enough for a cheap demo if Postgres is hosted elsewhere.

Add swap for Docker builds:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Docker if the image does not already include it:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in after adding the Docker group, or use `sudo docker` for the first session.

### App Setup

Clone the repo on the Droplet:

```bash
git clone https://github.com/richardlitang/support-copilot.git
cd support-copilot/deploy
```

Create the production environment file:

```bash
cp env.production.example .env.production
nano .env.production
```

Set at least:

```bash
DOMAIN=your-domain.example
APP_URL=https://your-domain.example
DATABASE_URL=postgresql://...
AI_PROVIDER=mock
```

Point the domain's `A` record at the Droplet public IPv4 before starting Caddy. Caddy will request and renew HTTPS certificates automatically.

Start the deployment:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Inspect it:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker
```

Test it:

```bash
curl http://localhost:3000/api/health
curl https://your-domain.example/api/health
curl https://your-domain.example/api/ready
```

### Update The Droplet

From the repo directory on the Droplet:

```bash
git pull --ff-only
cd deploy
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

### Stop Or Remove

Stop containers but keep volumes:

```bash
docker compose -f docker-compose.prod.yml down
```

Remove containers and volumes:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Cleanup

Delete the app resources:

```bash
kubectl delete -k infra/k8s/base
```

Delete the kind cluster:

```bash
kind delete cluster --name support-copilot
```

## Next Deployment Learning Steps

1. Keep using the raw manifests until the object model is comfortable.
2. Use the Helm chart to learn how `values.yaml` changes rendered Kubernetes manifests.
3. Add separate local, dev, and production values.
4. Define the secrets strategy for database and provider credentials.
5. Use Terraform for platform resources, not app manifests.
6. Use Argo CD to deploy the Helm chart.
