import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ContentAnalyzerService } from './content-analyzer.service';
import { ActionDispatcherService } from './action-dispatcher.service';
import { ContextModule } from '../context/context.module';
import { SkillModule } from '../skill/skill.module';
import { VisualizationModule } from '../visualization/visualization.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [ContextModule, SkillModule, VisualizationModule, LLMModule],
  providers: [AgentService, ContentAnalyzerService, ActionDispatcherService],
  exports: [AgentService],
})
export class AgentModule {}
