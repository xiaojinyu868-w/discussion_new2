import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";
import { ValidationPipe } from "@nestjs/common";
import * as dotenv from "dotenv";
import * as path from "path";
import { json, urlencoded } from "express";

async function bootstrap() {
  // 加载根目录的 .env 文件（统一配置）
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
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
