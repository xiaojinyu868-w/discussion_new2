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

@Module({
  imports: [
    forwardRef(() => TingwuModule),
    forwardRef(() => PollerModule),
    SkillModule,
    AutoPushModule,
    ContextModule,
    LLMModule,
    VisualizationModule,
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
