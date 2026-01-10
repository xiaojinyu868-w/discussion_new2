import { Injectable, Logger, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export interface User {
  id: number;
  username: string;
  nickname?: string;
  avatar_url?: string;
  login_type?: string;
  created_at: string;
}

export interface WechatUser {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
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
  private readonly WECHAT_APP_ID = process.env.WECHAT_APP_ID || '';
  private readonly WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || '';

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
      'INSERT INTO users (username, password_hash, login_type) VALUES (?, ?, ?)',
      [username, passwordHash, 'password']
    );
    const userId = result.lastInsertRowid as number;

    // 初始化配额
    this.initUserQuota(userId);

    this.logger.log(`User registered: ${username} (id: ${userId})`);

    const user = this.db.queryOne<User>(
      'SELECT id, username, nickname, avatar_url, login_type, created_at FROM users WHERE id = ?',
      [userId]
    )!;

    const token = this.generateToken(user);
    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    // 查找用户
    const userWithPassword = this.db.queryOne<User & { password_hash: string }>(
      'SELECT id, username, password_hash, nickname, avatar_url, login_type, created_at FROM users WHERE username = ?',
      [username]
    );

    if (!userWithPassword) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查是否是微信用户（没有密码）
    if (!userWithPassword.password_hash) {
      throw new UnauthorizedException('该账号为微信登录账号，请使用微信登录');
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, userWithPassword.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const user: User = {
      id: userWithPassword.id,
      username: userWithPassword.username,
      nickname: userWithPassword.nickname,
      avatar_url: userWithPassword.avatar_url,
      login_type: userWithPassword.login_type,
      created_at: userWithPassword.created_at,
    };

    this.logger.log(`User logged in: ${username}`);
    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * 微信登录 - 通过 code 换取用户信息
   */
  async wechatLogin(code: string): Promise<{ user: User; token: string }> {
    if (!this.WECHAT_APP_ID || !this.WECHAT_APP_SECRET) {
      throw new BadRequestException('微信登录未配置');
    }

    // 1. 通过 code 换取 access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${this.WECHAT_APP_ID}&secret=${this.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`;
    
    try {
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json() as any;
      
      if (tokenData.errcode) {
        this.logger.error(`WeChat token error: ${JSON.stringify(tokenData)}`);
        throw new BadRequestException(`微信授权失败: ${tokenData.errmsg}`);
      }

      const { access_token, openid, unionid } = tokenData;

      // 2. 获取用户信息
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
      const userInfoRes = await fetch(userInfoUrl);
      const wechatUser = await userInfoRes.json() as WechatUser & { errcode?: number; errmsg?: string };

      if (wechatUser.errcode) {
        this.logger.error(`WeChat userinfo error: ${JSON.stringify(wechatUser)}`);
        throw new BadRequestException(`获取微信用户信息失败: ${wechatUser.errmsg}`);
      }

      // 3. 查找或创建用户
      return this.findOrCreateWechatUser({
        openid: wechatUser.openid,
        unionid: unionid || wechatUser.unionid,
        nickname: wechatUser.nickname,
        headimgurl: wechatUser.headimgurl,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`WeChat login failed: ${error}`);
      throw new BadRequestException('微信登录失败，请重试');
    }
  }

  /**
   * 微信小程序登录 - 通过 code 换取 session
   */
  async wechatMiniLogin(code: string, userInfo?: { nickName?: string; avatarUrl?: string }): Promise<{ user: User; token: string }> {
    if (!this.WECHAT_APP_ID || !this.WECHAT_APP_SECRET) {
      throw new BadRequestException('微信登录未配置');
    }

    // 1. 通过 code 换取 session_key 和 openid
    const sessionUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.WECHAT_APP_ID}&secret=${this.WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
    
    try {
      const sessionRes = await fetch(sessionUrl);
      const sessionData = await sessionRes.json() as any;
      
      if (sessionData.errcode) {
        this.logger.error(`WeChat mini session error: ${JSON.stringify(sessionData)}`);
        throw new BadRequestException(`微信授权失败: ${sessionData.errmsg}`);
      }

      const { openid, unionid } = sessionData;

      // 2. 查找或创建用户
      return this.findOrCreateWechatUser({
        openid,
        unionid,
        nickname: userInfo?.nickName,
        headimgurl: userInfo?.avatarUrl,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`WeChat mini login failed: ${error}`);
      throw new BadRequestException('微信登录失败，请重试');
    }
  }

  /**
   * 查找或创建微信用户
   */
  private async findOrCreateWechatUser(wechatUser: WechatUser): Promise<{ user: User; token: string }> {
    // 先通过 openid 查找用户
    let user = this.db.queryOne<User>(
      'SELECT id, username, nickname, avatar_url, login_type, created_at FROM users WHERE openid = ?',
      [wechatUser.openid]
    );

    if (!user) {
      // 创建新用户
      const username = `wx_${wechatUser.openid.substring(0, 8)}`;
      const nickname = wechatUser.nickname || '微信用户';
      
      const result = this.db.run(
        'INSERT INTO users (username, openid, unionid, nickname, avatar_url, login_type) VALUES (?, ?, ?, ?, ?, ?)',
        [username, wechatUser.openid, wechatUser.unionid || null, nickname, wechatUser.headimgurl || null, 'wechat']
      );
      const userId = result.lastInsertRowid as number;

      // 初始化配额
      this.initUserQuota(userId);

      this.logger.log(`WeChat user created: ${username} (id: ${userId})`);

      user = this.db.queryOne<User>(
        'SELECT id, username, nickname, avatar_url, login_type, created_at FROM users WHERE id = ?',
        [userId]
      )!;
    } else {
      // 更新用户信息
      if (wechatUser.nickname || wechatUser.headimgurl) {
        this.db.run(
          'UPDATE users SET nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
          [wechatUser.nickname || null, wechatUser.headimgurl || null, user.id]
        );
        user = this.db.queryOne<User>(
          'SELECT id, username, nickname, avatar_url, login_type, created_at FROM users WHERE id = ?',
          [user.id]
        )!;
      }
      this.logger.log(`WeChat user logged in: ${user.username}`);
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * 初始化用户配额
   */
  private initUserQuota(userId: number): void {
    const now = new Date().toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    this.db.run(
      `INSERT INTO quotas (user_id, daily_reset_at, monthly_reset_at) VALUES (?, ?, ?)`,
      [userId, now, monthStart.toISOString()]
    );
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
      'SELECT id, username, nickname, avatar_url, login_type, created_at FROM users WHERE id = ?',
      [userId]
    );
  }

  /**
   * 获取微信登录授权URL
   */
  getWechatAuthUrl(redirectUri: string, state?: string): string {
    if (!this.WECHAT_APP_ID) {
      throw new BadRequestException('微信登录未配置');
    }
    const encodedUri = encodeURIComponent(redirectUri);
    const stateParam = state || 'STATE';
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${this.WECHAT_APP_ID}&redirect_uri=${encodedUri}&response_type=code&scope=snsapi_userinfo&state=${stateParam}#wechat_redirect`;
  }
}
