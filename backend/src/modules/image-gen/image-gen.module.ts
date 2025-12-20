import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ImageGenerationAdapter } from "./image-generation-adapter.service";

@Module({
  imports: [ConfigModule],
  providers: [ImageGenerationAdapter],
  exports: [ImageGenerationAdapter],
})
export class ImageGenModule {}

