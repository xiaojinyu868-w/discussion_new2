import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DashScopeASRService } from "./dashscope-asr.service";
import { ContextModule } from "../context/context.module";

@Module({
  imports: [ConfigModule, ContextModule],
  providers: [DashScopeASRService],
  exports: [DashScopeASRService],
})
export class DashScopeASRModule {}
