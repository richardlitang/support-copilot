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
