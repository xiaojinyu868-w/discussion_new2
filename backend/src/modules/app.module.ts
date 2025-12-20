import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SessionModule } from "./session/session.module";
import { ContextModule } from "./context/context.module";
import { LLMModule } from "./llm/llm.module";
import { AutoPushModule } from "./auto-push/auto-push.module";
import configuration from "../shared/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ContextModule,
    LLMModule,
    AutoPushModule,
    SessionModule,
  ],
})
export class AppModule {}
