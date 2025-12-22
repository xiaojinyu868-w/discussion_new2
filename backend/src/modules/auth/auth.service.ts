import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'meetmind-inner-test-secret-key';
  private readonly JWT_EXPIRES_IN = '7d';

  constructor(private readonly db: DatabaseService) {}

  async register(username: string, password: string): Promise<{ user: User; token: string }> {
    // 检查用户名是否已存在
    const existing = this.db.queryOne<User>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    // 插入用户
    const result = this.db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );
    const userId = result.lastInsertRowid as number;

    // 初始化配额
    const now = new Date().toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    this.db.run(
      `INSERT INTO quotas (user_id, daily_reset_at, monthly_reset_at) VALUES (?, ?, ?)`,
      [userId, now, monthStart.toISOString()]
    );

    this.logger.log(`User registered: ${username} (id: ${userId})`);

    const user = this.db.queryOne<User>(
      'SELECT id, username, created_at FROM users WHERE id = ?',
      [userId]
    )!;

    const token = this.generateToken(user);
    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    // 查找用户
    const userWithPassword = this.db.queryOne<User & { password_hash: string }>(
      'SELECT id, username, password_hash, created_at FROM users WHERE username = ?',
      [username]
    );

    if (!userWithPassword) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, userWithPassword.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const user: User = {
      id: userWithPassword.id,
      username: userWithPassword.username,
      created_at: userWithPassword.created_at,
    };

    this.logger.log(`User logged in: ${username}`);
    const token = this.generateToken(user);
    return { user, token };
  }

  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
    };
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Token 无效或已过期');
    }
  }

  getUserById(userId: number): User | undefined {
    return this.db.queryOne<User>(
      'SELECT id, username, created_at FROM users WHERE id = ?',
      [userId]
    );
  }
}
