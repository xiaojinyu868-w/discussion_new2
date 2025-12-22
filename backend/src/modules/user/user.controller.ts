import { Controller, Get, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { QuotaService } from '../quota/quota.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly quotaService: QuotaService,
  ) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const user = this.authService.getUserById(req.user.userId);
    const quota = this.quotaService.getQuotaStatus(req.user.userId);
    
    return {
      success: true,
      user,
      quota,
    };
  }

  @Get('me/meetings')
  async getMeetings(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const meetings = this.userService.getMeetings(
      req.user.userId,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0
    );
    
    return {
      success: true,
      meetings,
    };
  }

  @Get('me/meetings/:id')
  async getMeetingDetail(@Req() req: any, @Param('id') id: string) {
    const meeting = this.userService.getMeetingDetail(req.user.userId, parseInt(id));
    
    if (!meeting) {
      return { success: false, message: '会议不存在' };
    }
    
    return {
      success: true,
      meeting,
    };
  }

  @Delete('me/meetings/:id')
  async deleteMeeting(@Req() req: any, @Param('id') id: string) {
    const success = this.userService.deleteMeeting(req.user.userId, parseInt(id));
    
    return {
      success,
      message: success ? '删除成功' : '删除失败',
    };
  }
}
