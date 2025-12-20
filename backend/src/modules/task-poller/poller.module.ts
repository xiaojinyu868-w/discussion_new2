import { Module, forwardRef } from "@nestjs/common";
import { PollerService } from "./poller.service";
import { TingwuModule } from "../tingwu/tingwu.module";

@Module({
  imports: [forwardRef(() => TingwuModule)],
  providers: [PollerService],
  exports: [PollerService],
})
export class PollerModule {}
