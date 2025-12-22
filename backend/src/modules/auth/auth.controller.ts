import { Controller, Post, Body, Get, UseGuards, Req, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { IsString, MinLength } from 'class-validator';

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
