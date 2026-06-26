import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('bookings')
@UseGuards(SupabaseAuthGuard)
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Post(':id/location')
  updateLocation(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { latitude: number; longitude: number },
  ) {
    if (req.user.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can broadcast location coordinates');
    }
    return this.trackingService.updateLocation(id, req.user.id, body.latitude, body.longitude);
  }

  @Get(':id/location')
  getLocation(@Req() req, @Param('id') id: string) {
    return this.trackingService.getLocation(id, req.user.id);
  }
}
