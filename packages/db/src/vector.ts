import { PrismaClient } from "@prisma/client";

export interface SimilarSkillMatch {
  id: string;
  name: string;
  category: string;
  similarity: number;
}

export interface SimilarOccupationMatch {
  id: string;
  title: string;
  similarity: number;
}

function asVector(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function cosine(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

/**
 * MySQL/free-first equivalent of the old pgvector lookup. Embeddings are
 * stored as JSON by the deterministic worker and ranked in application code.
 */
export async function findSimilarSkills(
  prisma: PrismaClient,
  embedding: number[],
  limit = 10,
  minSimilarity = 0.7,
): Promise<SimilarSkillMatch[]> {
  const rows = await prisma.entityEmbedding.findMany({
    where: { entityType: "SKILL" },
    select: { entityId: true, vectorJson: true },
  });
  const ranked = rows
    .map((row) => ({ id: row.entityId, similarity: cosine(embedding, asVector(row.vectorJson)) }))
    .filter((row) => row.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  if (ranked.length === 0) return [];
  const skills = await prisma.skill.findMany({
    where: { id: { in: ranked.map((row) => row.id) } },
    select: { id: true, name: true, category: true },
  });
  return ranked.flatMap((row) => {
    const skill = skills.find((item) => item.id === row.id);
    return skill ? [{ ...skill, similarity: row.similarity }] : [];
  });
}

export async function findSimilarOccupations(
  prisma: PrismaClient,
  embedding: number[],
  limit = 5,
): Promise<SimilarOccupationMatch[]> {
  const rows = await prisma.entityEmbedding.findMany({
    where: { entityType: "OCCUPATION" },
    select: { entityId: true, vectorJson: true },
  });
  const ranked = rows
    .map((row) => ({ id: row.entityId, similarity: cosine(embedding, asVector(row.vectorJson)) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  if (ranked.length === 0) return [];
  const occupations = await prisma.occupation.findMany({
    where: { id: { in: ranked.map((row) => row.id) } },
    select: { id: true, title: true },
  });
  return ranked.flatMap((row) => {
    const occupation = occupations.find((item) => item.id === row.id);
    return occupation ? [{ ...occupation, similarity: row.similarity }] : [];
  });
}
