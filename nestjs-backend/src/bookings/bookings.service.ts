import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  async create(householdId: string, createBookingDto: CreateBookingDto) {
    const adminClient = this.supabaseService.getAdminClient();
    const { serviceId, scheduledAt, price } = createBookingDto;

    const { data, error } = await adminClient
      .from('bookings')
      .insert({
        household_id: householdId,
        service_id: serviceId,
        scheduled_at: scheduledAt,
        price,
        status: 'PENDING',
      })
      .select('*, services(name, icon)')
      .single();

    if (error) {
      this.logger.error(`Failed to create booking: ${error.message}`);
      throw new BadRequestException(`Failed to create booking: ${error.message}`);
    }

    // Notify workers offering this service category
    const services = Array.isArray(data.services) ? data.services[0] : data.services;
    const serviceName = services?.name || '';
    if (serviceName) {
      const { data: workers } = await adminClient
        .from('workers')
        .select('id, skills');

      if (workers) {
        const matchingWorkers = workers.filter(w =>
          w.skills && w.skills.some(skill => skill.toLowerCase().includes(serviceName.toLowerCase())),
        );

        for (const worker of matchingWorkers) {
          try {
            await this.notificationsService.createNotification(
              worker.id,
              'New Job Request',
              `New ${serviceName} job request available nearby!`,
              'NEW_BOOKING',
              data.id,
            );
          } catch (err) {
            this.logger.warn(`Failed to notify worker ${worker.id}: ${err.message}`);
          }
        }
      }
    }

    return this.mapBooking(data);
  }

  async findAll(userId: string, role: string, type?: 'upcoming' | 'completed' | 'cancelled') {
    const adminClient = this.supabaseService.getAdminClient();

    let query = adminClient
      .from('bookings')
      .select('id, status, price, scheduled_at, created_at, services(name, icon), users:household_id(name)');

    // 1. Filter by role
    if (role === 'WORKER') {
      query = query.eq('worker_id', userId);
    } else {
      query = query.eq('household_id', userId);
    }

    // 2. Filter by status type
    if (type === 'upcoming') {
      query = query.in('status', ['PENDING', 'ACCEPTED']);
    } else if (type === 'completed') {
      query = query.eq('status', 'COMPLETED');
    } else if (type === 'cancelled') {
      query = query.eq('status', 'CANCELLED');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list bookings: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve bookings: ${error.message}`);
    }

    return (data || []).map(b => this.mapBooking(b));
  }

  async accept(bookingId: string, workerId: string) {
    const adminClient = this.supabaseService.getAdminClient();

    // Verify booking is pending and unassigned
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('status, worker_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new NotFoundException('Booking request not found');
    }

    if (booking.status !== 'PENDING' || booking.worker_id !== null) {
      throw new BadRequestException('Booking cannot be accepted (already assigned or cancelled)');
    }

    const { data, error } = await adminClient
      .from('bookings')
      .update({
        status: 'ACCEPTED',
        worker_id: workerId,
      })
      .eq('id', bookingId)
      .select('*, services(name, icon), users:household_id(name)')
      .single();

    if (error) {
      this.logger.error(`Failed to accept booking: ${error.message}`);
      throw new BadRequestException(`Failed to accept booking: ${error.message}`);
    }

    // Fetch worker name for notification
    const { data: workerUser } = await adminClient
      .from('users')
      .select('name')
      .eq('id', workerId)
      .single();
    const workerName = workerUser?.name || 'A worker';

    try {
      await this.notificationsService.createNotification(
        data.household_id,
        'Booking Accepted',
        `${workerName} has accepted your booking request.`,
        'BOOKING_ACCEPTED',
        data.id,
      );
    } catch (err) {
      this.logger.warn(`Failed to send booking acceptance notification to ${data.household_id}: ${err.message}`);
    }

    return this.mapBooking(data);
  }

  async cancel(bookingId: string, userId: string, role: string) {
    const adminClient = this.supabaseService.getAdminClient();

    // Fetch booking to verify ownership and state
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new NotFoundException('Booking not found');
    }

    // Permission checks
    if (role === 'WORKER') {
      if (booking.worker_id !== userId) {
        throw new ForbiddenException('You are not assigned to this booking');
      }
      if (booking.status !== 'ACCEPTED') {
        throw new BadRequestException('Workers can only cancel accepted bookings');
      }
    } else {
      if (booking.household_id !== userId) {
        throw new ForbiddenException('You do not own this booking');
      }
      if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
        throw new BadRequestException('Completed or already cancelled bookings cannot be cancelled');
      }
    }

    const { data, error } = await adminClient
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', bookingId)
      .select('*, services(name, icon), users:household_id(name)')
      .single();

    if (error) {
      this.logger.error(`Failed to cancel booking: ${error.message}`);
      throw new BadRequestException(`Failed to cancel booking: ${error.message}`);
    }

    // Notify the opposite party
    const oppositeUserId = role === 'WORKER' ? data.household_id : data.worker_id;
    if (oppositeUserId) {
      try {
        await this.notificationsService.createNotification(
          oppositeUserId,
          'Booking Cancelled',
          'Your booking request has been cancelled.',
          'BOOKING_CANCELLED',
          data.id,
        );
      } catch (err) {
        this.logger.warn(`Failed to send cancellation notification to ${oppositeUserId}: ${err.message}`);
      }
    }

    return this.mapBooking(data);
  }

  async complete(bookingId: string, workerId: string) {
    const adminClient = this.supabaseService.getAdminClient();

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
      throw new BadRequestException('Only accepted bookings can be completed');
    }

    const { data, error } = await adminClient
      .from('bookings')
      .update({ status: 'COMPLETED' })
      .eq('id', bookingId)
      .select('*, services(name, icon), users:household_id(name)')
      .single();

    if (error) {
      this.logger.error(`Failed to complete booking: ${error.message}`);
      throw new BadRequestException(`Failed to complete booking: ${error.message}`);
    }

    // Fetch worker name for notification
    const { data: workerUser } = await adminClient
      .from('users')
      .select('name')
      .eq('id', workerId)
      .single();
    const workerName = workerUser?.name || 'A worker';

    try {
      await this.notificationsService.createNotification(
        data.household_id,
        'Booking Completed',
        `${workerName} has completed your job. Please rate their service!`,
        'BOOKING_COMPLETED',
        data.id,
      );
    } catch (err) {
      this.logger.warn(`Failed to send booking completion notification to ${data.household_id}: ${err.message}`);
    }

    return this.mapBooking(data);
  }

  // Helper queries for dashboard
  async findRecentForHousehold(householdId: string, limit = 5) {
    const adminClient = this.supabaseService.getAdminClient();
    const { data, error } = await adminClient
      .from('bookings')
      .select('id, status, price, scheduled_at, created_at, services(name, icon)')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return (data || []).map(b => this.mapBooking(b));
  }

  async findRecentForWorker(workerId: string, limit = 5) {
    const adminClient = this.supabaseService.getAdminClient();
    const { data, error } = await adminClient
      .from('bookings')
      .select('id, status, price, scheduled_at, created_at, services(name, icon), users:household_id(name)')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return (data || []).map(b => this.mapBooking(b));
  }

  async findPendingJobs(limit = 10) {
    const adminClient = this.supabaseService.getAdminClient();
    const { data, error } = await adminClient
      .from('bookings')
      .select('id, status, price, scheduled_at, created_at, services(name, icon), users:household_id(name)')
      .eq('status', 'PENDING')
      .is('worker_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return (data || []).map(b => this.mapBooking(b));
  }

  private mapBooking(booking: any) {
    const services = Array.isArray(booking.services) ? booking.services[0] : booking.services;
    const users = Array.isArray(booking.users) ? booking.users[0] : booking.users;

    return {
      id: booking.id,
      status: booking.status,
      price: booking.price,
      scheduledAt: booking.scheduled_at,
      createdAt: booking.created_at,
      serviceName: services?.name || 'Unknown Service',
      serviceIcon: services?.icon || 'build',
      customerName: users?.name || 'Unknown Customer',
    };
  }
}
