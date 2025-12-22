import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { QuotaService, QuotaType } from './quota.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('quota')
@UseGuards(AuthGuard)
export class QuotaController {
  constructor(private readonly quotaService: QuotaService) {}

  @Get('status')
  getStatus(@Req() req: any) {
    const status = this.quotaService.getQuotaStatus(req.user.userId);
    return {
      success: true,
      quota: status,
    };
  }

  @Get('check')
  checkQuota(@Req() req: any, @Query('type') type: QuotaType) {
    if (!type || !['insight', 'qa', 'image'].includes(type)) {
      return { success: false, message: '无效的配额类型' };
    }
    
    const result = this.quotaService.checkQuota(req.user.userId, type);
    return {
      success: true,
      ...result,
    };
  }
}
