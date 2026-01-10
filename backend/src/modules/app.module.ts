import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as path from "path";
import { SessionModule } from "./session/session.module";
import { ContextModule } from "./context/context.module";
import { LLMModule } from "./llm/llm.module";
import { AutoPushModule } from "./auto-push/auto-push.module";
import { AgentModule } from "./agent/agent.module";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { QuotaModule } from "./quota/quota.module";
import { UserModule } from "./user/user.module";
import configuration from "../shared/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 使用根目录的 .env 文件（统一配置）
      envFilePath: path.resolve(__dirname, "../../../.env"),
      load: [configuration],
    }),
    DatabaseModule,
    AuthModule,
    QuotaModule,
    UserModule,
    ContextModule,
    LLMModule,
    AutoPushModule,
    AgentModule,
    SessionModule,
  ],
})
export class AppModule {}
