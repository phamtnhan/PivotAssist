// REQ-0013 — Nest modules: storage, skills, interviews coaching — no offer/hire
// REQ-0023 — APP_GUARD on all Nest controllers
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { StorageController } from "./modules/storage/storage.controller.js";
import { StorageService } from "./modules/storage/storage.service.js";
import { SkillsController } from "./modules/skills/skills.controller.js";
import { SkillsService } from "./modules/skills/skills.service.js";
import { InterviewsController } from "./modules/interviews/interviews.controller.js";
import { InterviewsService } from "./modules/interviews/interviews.service.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [StorageController, SkillsController, InterviewsController],
  providers: [
    StorageService,
    SkillsService,
    InterviewsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
