// REQ-0023 — bind 127.0.0.1 unless API_BIND is explicit (0.0.0.0 only when set)
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:4000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(process.env.PORT || 4000);
  const bind = process.env.API_BIND?.trim() || "127.0.0.1";
  await app.listen(port, bind);
  console.log(`PivotAssist API running on http://${bind}:${port}`);
}

bootstrap();
