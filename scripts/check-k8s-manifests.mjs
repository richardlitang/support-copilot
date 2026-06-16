import { spawnSync } from "node:child_process";

const result = spawnSync("kubectl", ["kustomize", "infra/k8s/base"], {
  encoding: "utf8",
});

if (result.stdout && process.env.VERBOSE_K8S_CHECK === "true") {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Kubernetes manifests rendered successfully.");
