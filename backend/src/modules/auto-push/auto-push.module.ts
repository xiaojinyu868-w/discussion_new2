import { Module } from "@nestjs/common";
import { AutoPushService } from "./auto-push.service";

@Module({
  providers: [AutoPushService],
  exports: [AutoPushService],
})
export class AutoPushModule {}
