import { Controller, Get, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { QuotaService, QuotaType, RECHARGE_PACKAGES } from './quota.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('quota')
export class QuotaController {
  constructor(private readonly quotaService: QuotaService) {}

  // 获取配额状态（需要登录）
  @Get('status')
  @UseGuards(AuthGuard)
  getStatus(@Req() req: any) {
    const status = this.quotaService.getQuotaStatus(req.user.userId);
    return {
      success: true,
      quota: status,
    };
  }

  // 检查配额（需要登录）
  @Get('check')
  @UseGuards(AuthGuard)
  checkQuota(@Req() req: any, @Query('type') type: QuotaType) {
    if (!type || !['insight', 'qa', 'image', 'transcribe'].includes(type)) {
      return { success: false, message: '无效的配额类型' };
    }
    
    const result = this.quotaService.checkQuota(req.user.userId, type);
    return {
      success: true,
      ...result,
    };
  }

  // 获取充值套餐列表（公开）
  @Get('packages')
  getPackages() {
    return {
      success: true,
      packages: RECHARGE_PACKAGES,
    };
  }

  // 充值（需要登录）- 实际支付需要对接支付系统
  @Post('recharge')
  @UseGuards(AuthGuard)
  recharge(@Req() req: any, @Body() body: { packageId: string }) {
    if (!body.packageId) {
      return { success: false, message: '请选择充值套餐' };
    }

    // TODO: 实际环境需要对接微信支付/支付宝
    // 这里暂时直接增加配额（用于测试）
    const result = this.quotaService.recharge(req.user.userId, body.packageId);
    return result;
  }
}
