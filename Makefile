.PHONY: local-up local-down local-redeploy local-logs

local-up: ## Create kind cluster, build+load image, deploy local overlay
	./scripts/k8s-local.sh up

local-down: ## Delete the local kind cluster
	./scripts/k8s-local.sh down

local-redeploy: ## Rebuild image and restart web+worker (no cluster recreate)
	./scripts/k8s-local.sh redeploy

local-logs: ## Tail web+worker logs
	./scripts/k8s-local.sh logs
