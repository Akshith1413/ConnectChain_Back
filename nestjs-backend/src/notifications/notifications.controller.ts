import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req) {
    return this.notificationsService.findAll(req.user.id);
  }

  @Patch(':id/read')
  markAsRead(@Req() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Post('device-token')
  registerDeviceToken(
    @Req() req,
    @Body() body: { token: string; deviceType: 'android' | 'ios' },
  ) {
    return this.notificationsService.registerDeviceToken(req.user.id, body.token, body.deviceType);
  }
}
