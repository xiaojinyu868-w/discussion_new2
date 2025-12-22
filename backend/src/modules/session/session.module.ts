import { Module, forwardRef } from "@nestjs/common";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { TingwuModule } from "../tingwu/tingwu.module";
import { PollerModule } from "../task-poller/poller.module";
import { SkillModule } from "../skill/skill.module";
import { AutoPushModule } from "../auto-push/auto-push.module";
import { ContextModule } from "../context/context.module";
import { LLMModule } from "../llm/llm.module";
import { VisualizationModule } from "../visualization/visualization.module";
import { AgentModule } from "../agent/agent.module";
import { QuotaModule } from "../quota/quota.module";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";

@Module({
  imports: [
    forwardRef(() => TingwuModule),
    forwardRef(() => PollerModule),
    SkillModule,
    AutoPushModule,
    ContextModule,
    LLMModule,
    VisualizationModule,
    AgentModule,
    QuotaModule,
    AuthModule,
    UserModule,
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
