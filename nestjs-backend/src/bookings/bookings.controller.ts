import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
@UseGuards(SupabaseAuthGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  create(@Req() req, @Body() createBookingDto: CreateBookingDto) {
    if (req.user.role !== 'HOUSEHOLD') {
      throw new ForbiddenException('Only households can create service bookings');
    }
    return this.bookingsService.create(req.user.id, createBookingDto);
  }

  @Get()
  findAll(
    @Req() req,
    @Query('type') type?: 'upcoming' | 'completed' | 'cancelled',
  ) {
    return this.bookingsService.findAll(req.user.id, req.user.role, type);
  }

  @Get('recent')
  getRecentBookings(@Req() req) {
    const { id, role } = req.user;
    if (role === 'WORKER') {
      return this.bookingsService.findRecentForWorker(id);
    }
    return this.bookingsService.findRecentForHousehold(id);
  }

  @Patch(':id/accept')
  accept(@Req() req, @Param('id') id: string) {
    if (req.user.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can accept booking requests');
    }
    return this.bookingsService.accept(id, req.user.id);
  }

  @Patch(':id/cancel')
  cancel(@Req() req, @Param('id') id: string) {
    return this.bookingsService.cancel(id, req.user.id, req.user.role);
  }

  @Patch(':id/complete')
  complete(@Req() req, @Param('id') id: string) {
    if (req.user.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can complete bookings');
    }
    return this.bookingsService.complete(id, req.user.id);
  }
}
