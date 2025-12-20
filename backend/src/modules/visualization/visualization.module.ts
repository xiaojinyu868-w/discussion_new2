import { Module } from "@nestjs/common";
import { ContextModule } from "../context/context.module";
import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { ImageGenModule } from "../image-gen/image-gen.module";
import { VisualizationService } from "./visualization.service";

@Module({
  imports: [ContextModule, DataExtractionModule, ImageGenModule],
  providers: [VisualizationService],
  exports: [VisualizationService],
})
export class VisualizationModule {}

