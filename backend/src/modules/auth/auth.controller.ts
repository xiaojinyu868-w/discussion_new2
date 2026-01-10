import { Controller, Post, Body, Get, UseGuards, Req, Logger, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { IsString, MinLength, IsOptional } from 'class-validator';

class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

class WechatLoginDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  nickName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    this.logger.log(`Register request body: ${JSON.stringify(body)}`);
    
    if (!body.username || body.username.length < 3) {
      this.logger.warn(`Username validation failed: "${body.username}"`);
      return { success: false, message: '用户名至少3个字符' };
    }
    if (!body.password || body.password.length < 6) {
      return { success: false, message: '密码至少6个字符' };
    }

    try {
      const result = await this.authService.register(body.username, body.password);
      return {
        success: true,
        user: result.user,
        token: result.token,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '注册失败',
      };
    }
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    this.logger.log(`Login request body: ${JSON.stringify(body)}`);
    
    try {
      const result = await this.authService.login(body.username, body.password);
      return {
        success: true,
        user: result.user,
        token: result.token,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '登录失败',
      };
    }
  }

  /**
   * 微信网页授权登录
   */
  @Post('wechat')
  async wechatLogin(@Body() body: WechatLoginDto) {
    this.logger.log(`WeChat login request with code: ${body.code?.substring(0, 10)}...`);
    
    try {
      const result = await this.authService.wechatLogin(body.code);
      return {
        success: true,
        user: result.user,
        token: result.token,
      };
    } catch (error) {
      this.logger.error(`WeChat login failed: ${error.message}`);
      return {
        success: false,
        message: error.message || '微信登录失败',
      };
    }
  }

  /**
   * 微信小程序登录
   */
  @Post('wechat/mini')
  async wechatMiniLogin(@Body() body: WechatLoginDto) {
    this.logger.log(`WeChat mini login request with code: ${body.code?.substring(0, 10)}...`);
    
    try {
      const result = await this.authService.wechatMiniLogin(body.code, {
        nickName: body.nickName,
        avatarUrl: body.avatarUrl,
      });
      return {
        success: true,
        user: result.user,
        token: result.token,
      };
    } catch (error) {
      this.logger.error(`WeChat mini login failed: ${error.message}`);
      return {
        success: false,
        message: error.message || '微信登录失败',
      };
    }
  }

  /**
   * 获取微信授权URL（用于网页端跳转）
   */
  @Get('wechat/auth-url')
  getWechatAuthUrl(@Query('redirect_uri') redirectUri: string, @Query('state') state?: string) {
    try {
      if (!redirectUri) {
        return { success: false, message: '缺少 redirect_uri 参数' };
      }
      const authUrl = this.authService.getWechatAuthUrl(redirectUri, state);
      return {
        success: true,
        authUrl,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取授权URL失败',
      };
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: any) {
    const user = this.authService.getUserById(req.user.userId);
    return {
      success: true,
      user,
    };
  }
}
