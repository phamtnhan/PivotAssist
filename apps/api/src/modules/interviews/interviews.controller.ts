// REQ-0013 — coaching session/events/report only; not hiring pipeline
// REQ-0023 — authenticated; ignore client userId
import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { InterviewsService } from "./interviews.service.js";
import { InterviewSession, InterviewCoachingReport, VisualEvent } from "@pivotassist/contracts";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { NestAuthUser } from "../../auth/jwt-verify.js";

@Controller("interviews")
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post("session")
  async createSession(
    @CurrentUser() user: NestAuthUser,
    @Body()
    body: {
      userId?: string;
      targetRole: string;
      difficulty: "junior" | "mid" | "senior";
      jobId?: string;
      applicationId?: string;
    },
  ): Promise<InterviewSession> {
    return this.interviewsService.createSession(
      {
        userId: user.userId,
        targetRole: body.targetRole,
        difficulty: body.difficulty,
        jobId: body.jobId,
        applicationId: body.applicationId,
      },
      user,
    );
  }

  @Post(":sessionId/events")
  async recordEvents(
    @CurrentUser() user: NestAuthUser,
    @Param("sessionId") sessionId: string,
    @Body() body: { events: VisualEvent[] },
  ): Promise<{ success: boolean }> {
    await this.interviewsService.recordVisualEvents(sessionId, body.events ?? [], user);
    return { success: true };
  }

  @Get(":sessionId/report")
  async getReport(
    @CurrentUser() user: NestAuthUser,
    @Param("sessionId") sessionId: string,
  ): Promise<InterviewCoachingReport> {
    return this.interviewsService.getCoachingReport(sessionId, user);
  }
}
