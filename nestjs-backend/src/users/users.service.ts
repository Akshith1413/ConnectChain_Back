import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ServicesService } from '../services/services.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private supabaseService: SupabaseService,
    private servicesService: ServicesService,
    private bookingsService: BookingsService,
  ) {}

  async getProfile(userId: string, role: string) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Fetch base user profile
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User profile not found');
    }

    let extraDetails = {};

    // 2. Fetch role-specific details
    if (role === 'WORKER') {
      const { data: worker, error: workerError } = await adminClient
        .from('workers')
        .select('*')
        .eq('id', userId)
        .single();
      if (!workerError && worker) {
        extraDetails = {
          skills: worker.skills,
          rating: worker.rating,
        };
      }
    } else if (role === 'VENDOR') {
      const { data: vendor, error: vendorError } = await adminClient
        .from('vendors')
        .select('*')
        .eq('id', userId)
        .single();
      if (!vendorError && vendor) {
        extraDetails = {
          businessName: vendor.business_name,
        };
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      photoUrl: user.photo_url,
      theme: user.theme || 'LIGHT',
      createdAt: user.created_at,
      ...extraDetails,
    };
  }

  async updateProfile(userId: string, role: string, updateProfileDto: UpdateProfileDto) {
    const { name, phone, photoUrl, skills, businessName } = updateProfileDto;
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Prepare base updates
    const baseUpdates: any = {};
    if (name !== undefined) baseUpdates.name = name;
    if (phone !== undefined) baseUpdates.phone = phone;
    if (photoUrl !== undefined) baseUpdates.photo_url = photoUrl;

    if (Object.keys(baseUpdates).length > 0) {
      const { error: userError } = await adminClient
        .from('users')
        .update(baseUpdates)
        .eq('id', userId);

      if (userError) {
        this.logger.error(`Failed to update base user profile: ${userError.message}`);
        throw new BadRequestException(`Failed to update profile: ${userError.message}`);
      }
    }

    // 2. Prepare role updates
    if (role === 'WORKER' && skills !== undefined) {
      const { error: workerError } = await adminClient
        .from('workers')
        .update({ skills })
        .eq('id', userId);

      if (workerError) {
        this.logger.error(`Failed to update worker profile: ${workerError.message}`);
        throw new BadRequestException(`Failed to update worker details: ${workerError.message}`);
      }
    } else if (role === 'VENDOR' && businessName !== undefined) {
      const { error: vendorError } = await adminClient
        .from('vendors')
        .update({ business_name: businessName })
        .eq('id', userId);

      if (vendorError) {
        this.logger.error(`Failed to update vendor profile: ${vendorError.message}`);
        throw new BadRequestException(`Failed to update vendor details: ${vendorError.message}`);
      }
    }

    return this.getProfile(userId, role);
  }

  async updatePreferences(userId: string, role: string, theme: 'LIGHT' | 'DARK') {
    const adminClient = this.supabaseService.getAdminClient();

    const { error } = await adminClient
      .from('users')
      .update({ theme })
      .eq('id', userId);

    if (error) {
      this.logger.error(`Failed to update preferences: ${error.message}`);
      throw new BadRequestException(`Failed to update theme: ${error.message}`);
    }

    return this.getProfile(userId, role);
  }

  async deleteAccount(userId: string) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Delete database record in public.users
    const { error: dbError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userId);

    if (dbError) {
      this.logger.error(`Failed to delete database record during account deletion: ${dbError.message}`);
      throw new InternalServerErrorException(`Failed to delete profile records: ${dbError.message}`);
    }

    // 2. Delete auth user in Supabase
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      this.logger.error(`Failed to delete auth user during account deletion: ${authError.message}`);
      throw new InternalServerErrorException(`Failed to delete authentication credentials: ${authError.message}`);
    }

    return {
      message: 'Account successfully deleted',
    };
  }

  async getDashboardData(userId: string, role: string) {
    if (role === 'WORKER') {
      const [pendingJobs, recentBookings] = await Promise.all([
        this.bookingsService.findPendingJobs(),
        this.bookingsService.findRecentForWorker(userId),
      ]);
      return {
        role,
        pendingJobs,
        recentBookings,
      };
    } else {
      const [services, recentBookings] = await Promise.all([
        this.servicesService.findAll(),
        this.bookingsService.findRecentForHousehold(userId),
      ]);
      return {
        role,
        services,
        recentBookings,
      };
    }
  }
}
