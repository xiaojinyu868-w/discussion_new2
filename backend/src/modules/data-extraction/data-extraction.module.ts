import { Module } from "@nestjs/common";
import { LLMModule } from "../llm/llm.module";
import { DataExtractionService } from "./data-extraction.service";

@Module({
  imports: [LLMModule],
  providers: [DataExtractionService],
  exports: [DataExtractionService],
})
export class DataExtractionModule {}

