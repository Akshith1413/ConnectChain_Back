import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private supabaseService: SupabaseService) {}

  async createNotification(
    userId: string,
    title: string,
    body: string,
    type: string,
    referenceId?: string,
  ) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Insert notification in database
    const { data, error } = await adminClient
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        body,
        type,
        reference_id: referenceId,
        is_read: false,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to save notification: ${error.message}`);
      throw new BadRequestException(`Failed to create notification: ${error.message}`);
    }

    // 2. Fetch target user's device token for mock push notification
    const { data: device } = await adminClient
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();

    if (device?.token) {
      this.logger.log(`[MOCK PUSH] Sending FCM Push Notification to device token "${device.token}":`);
      this.logger.log(`Title: "${title}" | Body: "${body}"`);
    } else {
      this.logger.log(`[IN-APP ONLY] Saved in-app notification for user ${userId} (no device token registered):`);
      this.logger.log(`Title: "${title}" | Body: "${body}"`);
    }

    return data;
  }

  async findAll(userId: string) {
    const adminClient = this.supabaseService.getAdminClient();

    const { data, error } = await adminClient
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch notifications for user ${userId}: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve notifications: ${error.message}`);
    }

    return data || [];
  }

  async markAsRead(notificationId: string, userId: string) {
    const adminClient = this.supabaseService.getAdminClient();

    const { data, error } = await adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to mark notification as read: ${error?.message}`);
      throw new NotFoundException('Notification not found or access denied');
    }

    return data;
  }

  async registerDeviceToken(userId: string, token: string, deviceType: 'android' | 'ios') {
    const adminClient = this.supabaseService.getAdminClient();

    const { data, error } = await adminClient
      .from('device_tokens')
      .upsert({
        user_id: userId,
        token,
        device_type: deviceType,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to register device token: ${error.message}`);
      throw new BadRequestException(`Failed to register token: ${error.message}`);
    }

    return {
      message: 'Device token registered successfully',
      deviceToken: data.token,
    };
  }
}
