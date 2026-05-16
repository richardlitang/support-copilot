import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getRuntimeConfig } from "@/src/server/config/env";
import { JOB_NAMES, QUEUE_NAMES } from "@/src/server/queue/names";
import type { DocumentIngestionJob } from "@/src/server/queue/jobs";

let connection: IORedis | null = null;
let documentIngestionQueue: Queue<DocumentIngestionJob> | null = null;

export function getRedisConnection() {
  if (connection) {
    return connection;
  }

  connection = new IORedis(getRuntimeConfig().redisUrl, {
    maxRetriesPerRequest: null,
  });

  return connection;
}

export function getDocumentIngestionQueue() {
  if (documentIngestionQueue) {
    return documentIngestionQueue;
  }

  documentIngestionQueue = new Queue<DocumentIngestionJob>(QUEUE_NAMES.documentIngestion, {
    connection: getRedisConnection(),
  });

  return documentIngestionQueue;
}

export async function enqueueDocumentIngestionJob(job: DocumentIngestionJob) {
  const queue = getDocumentIngestionQueue();

  return queue.add(JOB_NAMES.documentIngestion, job, {
    jobId: `document-${job.documentId}`,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
}

export async function checkRedisReady() {
  const redis = getRedisConnection();
  const result = await redis.ping();

  if (result !== "PONG") {
    throw new Error("Redis ping failed.");
  }
}
