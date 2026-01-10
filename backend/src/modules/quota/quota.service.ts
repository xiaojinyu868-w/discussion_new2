import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type QuotaType = 'insight' | 'qa' | 'image' | 'transcribe';

export interface QuotaStatus {
  dailyInsight: { limit: number; used: number; remaining: number };
  dailyQa: { limit: number; used: number; remaining: number };
  monthlyImage: { limit: number; used: number; remaining: number };
  dailyTranscribe: { limit: number; used: number; remaining: number };
  balance: number; // 账户余额（元）
}

// 配额价格（元）- 确保50%+利润空间
export const QUOTA_PRICES = {
  image: 0.6,      // 生图 0.6元/张 (成本约0.2元，利润66%)
  insight: 0.03,   // AI洞察 0.03元/次 (成本约0.008元，利润73%)
  qa: 0.03,        // 问答 0.03元/次 (成本约0.008元，利润73%)
  transcribe: 0.05, // 转录 0.05元/分钟 (成本约0.01元，利润80%)
};

// 充值套餐 - 按新定价计算，保证50%+利润
export const RECHARGE_PACKAGES = [
  { id: 'pkg_10', name: '10元套餐', price: 10, images: 12, insights: 200, qa: 200, transcribe: 120 },
  { id: 'pkg_30', name: '30元套餐', price: 30, images: 40, insights: 700, qa: 700, transcribe: 400 },
  { id: 'pkg_100', name: '100元套餐', price: 100, images: 150, insights: 2500, qa: 2500, transcribe: 1500 },
];

interface QuotaRecord {
  id: number;
  user_id: number;
  daily_insight_limit: number;
  daily_insight_used: number;
  daily_qa_limit: number;
  daily_qa_used: number;
  monthly_image_limit: number;
  monthly_image_used: number;
  daily_transcribe_limit: number;
  daily_transcribe_used: number;
  balance: number;
  daily_reset_at: string;
  monthly_reset_at: string;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private readonly db: DatabaseService) {}

  // 获取配额状态
  getQuotaStatus(userId: number): QuotaStatus {
    this.checkAndResetQuota(userId);
    
    const quota = this.db.queryOne<QuotaRecord>(
      'SELECT * FROM quotas WHERE user_id = ?',
      [userId]
    );

    if (!quota) {
      this.initQuota(userId);
      return this.getQuotaStatus(userId);
    }

    return {
      dailyInsight: {
        limit: quota.daily_insight_limit,
        used: quota.daily_insight_used,
        remaining: Math.max(0, quota.daily_insight_limit - quota.daily_insight_used),
      },
      dailyQa: {
        limit: quota.daily_qa_limit,
        used: quota.daily_qa_used,
        remaining: Math.max(0, quota.daily_qa_limit - quota.daily_qa_used),
      },
      monthlyImage: {
        limit: quota.monthly_image_limit,
        used: quota.monthly_image_used,
        remaining: Math.max(0, quota.monthly_image_limit - quota.monthly_image_used),
      },
      dailyTranscribe: {
        limit: quota.daily_transcribe_limit ?? 60,
        used: quota.daily_transcribe_used ?? 0,
        remaining: Math.max(0, (quota.daily_transcribe_limit ?? 60) - (quota.daily_transcribe_used ?? 0)),
      },
      balance: quota.balance ?? 0,
    };
  }

  // 检查配额是否充足
  checkQuota(userId: number, type: QuotaType): { allowed: boolean; remaining: number; message?: string } {
    this.checkAndResetQuota(userId);
    
    const quota = this.db.queryOne<QuotaRecord>(
      'SELECT * FROM quotas WHERE user_id = ?',
      [userId]
    );

    if (!quota) {
      this.initQuota(userId);
      return this.checkQuota(userId, type);
    }

    let limit: number, used: number, name: string, period: string;
    switch (type) {
      case 'insight':
        limit = quota.daily_insight_limit;
        used = quota.daily_insight_used;
        name = 'AI洞察';
        period = '今日';
        break;
      case 'qa':
        limit = quota.daily_qa_limit;
        used = quota.daily_qa_used;
        name = '会议问答';
        period = '今日';
        break;
      case 'image':
        limit = quota.monthly_image_limit;
        used = quota.monthly_image_used;
        name = '图片生成';
        period = '本月';
        break;
      case 'transcribe':
        limit = quota.daily_transcribe_limit ?? 60;
        used = quota.daily_transcribe_used ?? 0;
        name = '语音转录';
        period = '今日';
        break;
    }

    const remaining = limit - used;
    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: `${name}配额已用完（${period}限${limit}次），请充值获取更多额度`,
      };
    }

    return { allowed: true, remaining };
  }

  // 消耗配额
  consumeQuota(userId: number, type: QuotaType, amount: number = 1): boolean {
    const check = this.checkQuota(userId, type);
    if (!check.allowed) {
      throw new ForbiddenException(check.message);
    }

    let column: string;
    switch (type) {
      case 'insight':
        column = 'daily_insight_used';
        break;
      case 'qa':
        column = 'daily_qa_used';
        break;
      case 'image':
        column = 'monthly_image_used';
        break;
      case 'transcribe':
        column = 'daily_transcribe_used';
        break;
    }

    this.db.run(
      `UPDATE quotas SET ${column} = ${column} + ? WHERE user_id = ?`,
      [amount, userId]
    );

    this.logger.log(`Quota consumed: user=${userId}, type=${type}, amount=${amount}`);
    return true;
  }

  // 充值 - 增加配额
  recharge(userId: number, packageId: string): { success: boolean; message: string; quota?: QuotaStatus } {
    const pkg = RECHARGE_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      return { success: false, message: '无效的充值套餐' };
    }

    // 增加配额
    this.db.run(
      `UPDATE quotas SET 
        monthly_image_limit = monthly_image_limit + ?,
        daily_insight_limit = daily_insight_limit + ?,
        daily_qa_limit = daily_qa_limit + ?,
        daily_transcribe_limit = daily_transcribe_limit + ?,
        balance = balance + ?
      WHERE user_id = ?`,
      [pkg.images, pkg.insights, pkg.qa, pkg.transcribe, pkg.price, userId]
    );

    this.logger.log(`User ${userId} recharged with package ${packageId}`);
    
    return {
      success: true,
      message: `充值成功！获得 ${pkg.images} 张图片生成额度`,
      quota: this.getQuotaStatus(userId),
    };
  }

  // 获取充值套餐列表
  getRechargePackages() {
    return RECHARGE_PACKAGES;
  }

  // 检查并重置过期配额
  private checkAndResetQuota(userId: number) {
    const quota = this.db.queryOne<QuotaRecord>(
      'SELECT * FROM quotas WHERE user_id = ?',
      [userId]
    );

    if (!quota) return;

    const now = new Date();
    const dailyResetAt = quota.daily_reset_at ? new Date(quota.daily_reset_at) : new Date(0);
    const monthlyResetAt = quota.monthly_reset_at ? new Date(quota.monthly_reset_at) : new Date(0);

    // 检查是否需要重置每日配额
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dailyResetAt < today) {
      // 重置每日使用量，但保留限额（充值增加的）
      this.db.run(
        `UPDATE quotas SET daily_insight_used = 0, daily_qa_used = 0, daily_transcribe_used = 0, daily_reset_at = ? WHERE user_id = ?`,
        [now.toISOString(), userId]
      );
      this.logger.log(`Daily quota reset for user ${userId}`);
    }

    // 检查是否需要重置每月配额
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    if (monthlyResetAt < monthStart) {
      // 重置每月使用量，但保留限额
      this.db.run(
        `UPDATE quotas SET monthly_image_used = 0, monthly_reset_at = ? WHERE user_id = ?`,
        [now.toISOString(), userId]
      );
      this.logger.log(`Monthly quota reset for user ${userId}`);
    }
  }

  // 初始化配额（新用户）
  initQuota(userId: number) {
    const now = new Date().toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // 免费用户默认配额：生图2张/月，洞察20次/天，问答30次/天，转录60分钟/天
    this.db.run(
      `INSERT OR IGNORE INTO quotas (
        user_id, 
        daily_insight_limit, daily_qa_limit, monthly_image_limit, daily_transcribe_limit,
        balance,
        daily_reset_at, monthly_reset_at
      ) VALUES (?, 20, 30, 2, 60, 0, ?, ?)`,
      [userId, now, monthStart.toISOString()]
    );
    
    this.logger.log(`Initialized quota for user ${userId}`);
  }
}
