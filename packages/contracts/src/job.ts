import { z } from "zod";
import { SkillSchema } from "./career.js";

export const JobMatchScorecardSchema = z.object({
  overallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  experienceScore: z.number().min(0).max(100),
  domainScore: z.number().min(0).max(100),
  softSkillsScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingRequiredSkills: z.array(z.string()),
  missingNiceToHaveSkills: z.array(z.string()),
  atsCompatibilityScore: z.number().min(0).max(100),
  atsMissingKeywords: z.array(z.string()),
});
export type JobMatchScorecard = z.infer<typeof JobMatchScorecardSchema>;

export const BulletPointRewriteSchema = z.object({
  originalBullet: z.string(),
  rewrittenBullet: z.string(),
  reasoning: z.string(),
  keywordsInjected: z.array(z.string()),
  formulaUsed: z.literal("XYZ_FORMULA"),
});
export type BulletPointRewrite = z.infer<typeof BulletPointRewriteSchema>;

export const JobListingSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  companyLogoUrl: z.string().optional(),
  title: z.string(),
  location: z.string(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "REMOTE"]),
  salaryRange: z.string().optional(),
  postedAt: z.string(),
  sourceUrl: z.string(),
  descriptionHtml: z.string(),
  matchScorecard: JobMatchScorecardSchema.optional(),
  requiredSkills: z.array(SkillSchema),
  niceToHaveSkills: z.array(SkillSchema),
  bulletRewrites: z.array(BulletPointRewriteSchema).optional(),
});
export type JobListing = z.infer<typeof JobListingSchema>;
