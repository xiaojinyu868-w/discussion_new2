import { Global, Module } from "@nestjs/common";
import { ContextStoreService } from "./context-store.service";

@Global()
@Module({
  providers: [ContextStoreService],
  exports: [ContextStoreService],
})
export class ContextModule {}
