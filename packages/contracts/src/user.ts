import { z } from "zod";
import { SkillSchema } from "./career.js";

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  avatarUrl: z.string().optional(),
  currentJobTitle: z.string(),
  targetJobTitle: z.string(),
  yearsOfExperience: z.number(),
  targetSalaryMin: z.number().optional(),
  targetSalaryMax: z.number().optional(),
  currency: z.string().default("USD"),
  skills: z.array(SkillSchema).default([]),
  preferredLanguage: z.enum(["vi", "en"]).default("vi"),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
