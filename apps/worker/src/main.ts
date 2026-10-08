// REQ-0008 — start BullMQ workers only when REDIS_URL is set
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { processResumeParse } from "./resume/parse-resume.worker.js";
import { processEmbeddingGeneration } from "./embeddings/generate-embedding.worker.js";
import { processReportGeneration } from "./interview/report-generation.worker.js";

const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

async function startWorkers() {
  if (!process.env.REDIS_URL) {
    console.log(
      "REDIS_URL is not configured; using synchronous free-first processing in the web API.",
    );
    return;
  }
  console.log("Starting PivotAssist BullMQ Background Workers...");

  const resumeWorker = new Worker("resume-queue", processResumeParse, {
    connection: redisConnection,
    concurrency: 4,
  });

  const embeddingWorker = new Worker("embedding-queue", processEmbeddingGeneration, {
    connection: redisConnection,
    concurrency: 2,
  });

  const reportWorker = new Worker("report-queue", processReportGeneration, {
    connection: redisConnection,
    concurrency: 2,
  });

  console.log("All BullMQ Workers successfully initialized.");

  process.on("SIGTERM", async () => {
    console.log("Shutting down workers gracefully...");
    await Promise.all([resumeWorker.close(), embeddingWorker.close(), reportWorker.close()]);
    await redisConnection.quit();
    process.exit(0);
  });
}

startWorkers().catch((err) => {
  console.error("Worker startup error:", err);
});
