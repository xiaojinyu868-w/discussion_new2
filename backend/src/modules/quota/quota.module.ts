import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { QuotaController } from './quota.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QuotaController],
  providers: [QuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}
