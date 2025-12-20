import { Module } from "@nestjs/common";
import { TingwuService } from "./tingwu.service";
import { AudioRelayService } from "./audio-relay.service";
import { ContextModule } from "../context/context.module";

@Module({
  imports: [ContextModule],
  providers: [TingwuService, AudioRelayService],
  exports: [TingwuService, AudioRelayService],
})
export class TingwuModule {}
