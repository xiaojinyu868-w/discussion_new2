import { Global, Module } from "@nestjs/common";
import { LLMAdapterService } from "./llm-adapter.service";

@Global()
@Module({
  providers: [LLMAdapterService],
  exports: [LLMAdapterService],
})
export class LLMModule {}
