import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type QuotaType = 'insight' | 'qa' | 'image';

export interface QuotaStatus {
  dailyInsight: { limit: number; used: number; remaining: number };
  dailyQa: { limit: number; used: number; remaining: number };
  monthlyImage: { limit: number; used: number; remaining: number };
}

interface QuotaRecord {
  id: number;
  user_id: number;
  daily_insight_limit: number;
  daily_insight_used: number;
  daily_qa_limit: number;
  daily_qa_used: number;
  monthly_image_limit: number;
  monthly_image_used: number;
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
      // 如果没有配额记录，创建一个
      this.initQuota(userId);
      return this.getQuotaStatus(userId);
    }

    return {
      dailyInsight: {
        limit: quota.daily_insight_limit,
        used: quota.daily_insight_used,
        remaining: quota.daily_insight_limit - quota.daily_insight_used,
      },
      dailyQa: {
        limit: quota.daily_qa_limit,
        used: quota.daily_qa_used,
        remaining: quota.daily_qa_limit - quota.daily_qa_used,
      },
      monthlyImage: {
        limit: quota.monthly_image_limit,
        used: quota.monthly_image_used,
        remaining: quota.monthly_image_limit - quota.monthly_image_used,
      },
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

    let limit: number, used: number, name: string;
    switch (type) {
      case 'insight':
        limit = quota.daily_insight_limit;
        used = quota.daily_insight_used;
        name = 'AI洞察';
        break;
      case 'qa':
        limit = quota.daily_qa_limit;
        used = quota.daily_qa_used;
        name = '会议问答';
        break;
      case 'image':
        limit = quota.monthly_image_limit;
        used = quota.monthly_image_used;
        name = '图片生成';
        break;
    }

    const remaining = limit - used;
    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: `${name}配额已用完（${type === 'image' ? '本月' : '今日'}限${limit}次）`,
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
    }

    this.db.run(
      `UPDATE quotas SET ${column} = ${column} + ? WHERE user_id = ?`,
      [amount, userId]
    );

    this.logger.log(`Quota consumed: user=${userId}, type=${type}, amount=${amount}`);
    return true;
  }

  // 检查并重置过期配额
  private checkAndResetQuota(userId: number) {
    const quota = this.db.queryOne<QuotaRecord>(
      'SELECT * FROM quotas WHERE user_id = ?',
      [userId]
    );

    if (!quota) return;

    const now = new Date();
    const dailyResetAt = new Date(quota.daily_reset_at);
    const monthlyResetAt = new Date(quota.monthly_reset_at);

    // 检查是否需要重置每日配额
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dailyResetAt < today) {
      this.db.run(
        `UPDATE quotas SET daily_insight_used = 0, daily_qa_used = 0, daily_reset_at = ? WHERE user_id = ?`,
        [now.toISOString(), userId]
      );
      this.logger.log(`Daily quota reset for user ${userId}`);
    }

    // 检查是否需要重置每月配额
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    if (monthlyResetAt < monthStart) {
      this.db.run(
        `UPDATE quotas SET monthly_image_used = 0, monthly_reset_at = ? WHERE user_id = ?`,
        [now.toISOString(), userId]
      );
      this.logger.log(`Monthly quota reset for user ${userId}`);
    }
  }

  // 初始化配额
  private initQuota(userId: number) {
    const now = new Date().toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    this.db.run(
      `INSERT OR IGNORE INTO quotas (user_id, daily_reset_at, monthly_reset_at) VALUES (?, ?, ?)`,
      [userId, now, monthStart.toISOString()]
    );
  }
}
