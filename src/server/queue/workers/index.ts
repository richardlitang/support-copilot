import { createDocumentIngestionWorker } from "@/src/server/queue/workers/documentIngestionWorker";

const worker = createDocumentIngestionWorker();

worker.on("ready", () => {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      route: "worker",
      event: "worker_ready",
    }),
  );
});

worker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      route: "worker",
      event: "job_failed",
      jobId: job?.id,
      jobName: job?.name,
      message: error.message,
    }),
  );
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
