import { Controller, Get, Query } from "@nestjs/common";
import { SkillsService } from "./skills.service.js";
import { CareerPivotAssessment, CareerRoadmap } from "@pivotassist/contracts";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { NestAuthUser } from "../../auth/jwt-verify.js";

@Controller("skills")
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get("assessment")
  async getAssessment(
    @CurrentUser() user: NestAuthUser,
    @Query("targetRole") targetRole = "AI & Full-Stack Solutions Architect",
  ): Promise<CareerPivotAssessment> {
    return this.skillsService.getCareerAssessment(user.userId, targetRole);
  }

  @Get("roadmap")
  async getRoadmap(@CurrentUser() user: NestAuthUser): Promise<CareerRoadmap> {
    return this.skillsService.getRoadmap(user.userId);
  }
}
