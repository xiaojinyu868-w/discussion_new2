import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";
import { ValidationPipe } from "@nestjs/common";
import * as dotenv from "dotenv";
import { json, urlencoded } from "express";

async function bootstrap() {
  dotenv.config();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: true,
    credentials: false,
  });

  app.use(json({ limit: "15mb" }));
  app.use(
    urlencoded({
      extended: true,
      limit: "15mb",
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
