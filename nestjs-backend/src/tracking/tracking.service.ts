import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private supabaseService: SupabaseService) {}

  async updateLocation(bookingId: string, workerId: string, lat: number, lng: number) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Fetch booking to verify assignment and status
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('status, worker_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.worker_id !== workerId) {
      throw new ForbiddenException('You are not assigned to this booking');
    }

    if (booking.status !== 'ACCEPTED') {
      throw new BadRequestException('Location updates are only allowed for active/accepted bookings');
    }

    // 2. Update the worker's coordinates in the users table
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        latitude: lat,
        longitude: lng,
      })
      .eq('id', workerId);

    if (updateError) {
      this.logger.error(`Failed to update worker coordinates: ${updateError.message}`);
      throw new BadRequestException(`Failed to update coordinates: ${updateError.message}`);
    }

    return {
      bookingId,
      latitude: lat,
      longitude: lng,
      updatedAt: new Date().toISOString(),
    };
  }

  async getLocation(bookingId: string, userId: string) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Fetch booking details
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('household_id, worker_id, status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new NotFoundException('Booking not found');
    }

    // 2. Verify caller has permission to view tracking
    if (booking.household_id !== userId && booking.worker_id !== userId) {
      throw new ForbiddenException('You are not authorized to track this booking');
    }

    if (!booking.worker_id) {
      throw new BadRequestException('No worker is assigned to this booking yet');
    }

    // 3. Fetch assigned worker's profile coordinates
    const { data: worker, error: workerError } = await adminClient
      .from('users')
      .select('name, photo_url, latitude, longitude')
      .eq('id', booking.worker_id)
      .single();

    if (workerError || !worker) {
      throw new NotFoundException('Worker profile not found');
    }

    return {
      bookingId,
      status: booking.status,
      workerId: booking.worker_id,
      workerName: worker.name,
      photoUrl: worker.photo_url || '',
      latitude: worker.latitude !== null ? Number(worker.latitude) : null,
      longitude: worker.longitude !== null ? Number(worker.longitude) : null,
    };
  }
}
