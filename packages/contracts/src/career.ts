import { z } from "zod";

export const SkillTypeSchema = z.enum(["HARD", "SOFT", "TOOL", "DOMAIN", "LANGUAGE"]);
export type SkillType = z.infer<typeof SkillTypeSchema>;

export const SkillStatusSchema = z.enum(["TRANSFERABLE", "ADJACENT", "MISSING", "PROFICIENT"]);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  escoUri: z.string().optional(),
  name: z.string(),
  category: z.string(),
  type: SkillTypeSchema,
  status: SkillStatusSchema.default("PROFICIENT"),
  levelScore: z.number().min(0).max(100).default(80),
  description: z.string().optional(),
  yearsOfExperience: z.number().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const CareerPivotAssessmentSchema = z.object({
  currentRole: z.string(),
  targetRole: z.string(),
  overallFeasibilityScore: z.number().min(0).max(100),
  estimatedMonthsToTransition: z.number(),
  transferableSkillsCount: z.number(),
  missingSkillsCount: z.number(),
  radarScores: z.object({
    technicalFit: z.number().min(0).max(100),
    experienceFit: z.number().min(0).max(100),
    domainFit: z.number().min(0).max(100),
    softSkillsFit: z.number().min(0).max(100),
  }),
  skillsBreakdown: z.object({
    transferable: z.array(SkillSchema),
    adjacent: z.array(SkillSchema),
    missing: z.array(SkillSchema),
  }),
  alternativeRoleRecommendations: z.array(
    z.object({
      roleTitle: z.string(),
      matchPercentage: z.number(),
      difficulty: z.enum(["EASY", "MODERATE", "CHALLENGING"]),
      bridgeSkills: z.array(z.string()),
    }),
  ),
});
export type CareerPivotAssessment = z.infer<typeof CareerPivotAssessmentSchema>;

export const LearningResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string(),
  url: z.string(),
  type: z.enum(["COURSE", "BOOK", "DOCUMENTATION", "PROJECT", "VIDEO"]),
  estimatedHours: z.number(),
  costType: z.enum(["FREE", "PAID"]),
  rating: z.number().optional(),
});
export type LearningResource = z.infer<typeof LearningResourceSchema>;

export const RoadmapTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  targetSkill: z.string(),
  estimatedDays: z.number(),
  isCompleted: z.boolean().default(false),
  resources: z.array(LearningResourceSchema).default([]),
});
export type RoadmapTask = z.infer<typeof RoadmapTaskSchema>;

export const RoadmapPhaseSchema = z.enum(["PHASE_30_DAYS", "PHASE_60_DAYS", "PHASE_90_DAYS"]);
export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>;

export const RoadmapMilestoneSchema = z.object({
  phase: RoadmapPhaseSchema,
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  tasks: z.array(RoadmapTaskSchema),
  capstoneProject: z
    .object({
      title: z.string(),
      deliverable: z.string(),
      technologies: z.array(z.string()),
      githubStarterTemplateUrl: z.string().optional(),
    })
    .optional(),
});
export type RoadmapMilestone = z.infer<typeof RoadmapMilestoneSchema>;

export const CareerRoadmapSchema = z.object({
  id: z.string(),
  userId: z.string(),
  targetRole: z.string(),
  createdAt: z.string(),
  progressPercentage: z.number().min(0).max(100),
  milestones: z.array(RoadmapMilestoneSchema),
});
export type CareerRoadmap = z.infer<typeof CareerRoadmapSchema>;
