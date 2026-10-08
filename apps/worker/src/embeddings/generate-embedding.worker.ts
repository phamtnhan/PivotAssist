import { Job } from "bullmq";
import { prisma } from "@pivotassist/db";

export interface GenerateEmbeddingJobData {
  entityType: "SKILL" | "OCCUPATION" | "JOB" | "RESUME";
  entityId: string;
  textToEmbed: string;
}

export async function processEmbeddingGeneration(job: Job<GenerateEmbeddingJobData>) {
  const { entityType, entityId, textToEmbed } = job.data;
  console.log(
    `[Worker] Generating vector embedding for entityType=${entityType}, entityId=${entityId}`,
  );

  // Free-first deterministic embedding. It is not a semantic model, but it is
  // stable, local and useful for indexing/reproducible tests without a paid key.
  const dimensions = 64;
  const vector = Array.from({ length: dimensions }, () => 0);
  for (let index = 0; index < textToEmbed.length; index += 1) {
    const code = textToEmbed.charCodeAt(index);
    vector[(code + index) % dimensions] += ((code % 31) + 1) / 31;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  const normalized = vector.map((value) => Number((value / norm).toFixed(8)));
  await prisma.entityEmbedding.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, dimensions, vectorJson: normalized, modelName: "free-hash-v1" },
    update: { dimensions, vectorJson: normalized, modelName: "free-hash-v1" },
  });
  return { success: true, dimensions, modelName: "free-hash-v1" };
}
