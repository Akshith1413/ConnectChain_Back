import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient: SupabaseClient;
  private supabaseAdminClient: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY') || this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_SECRET_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.error('SUPABASE_URL or SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY is missing from environment config.');
      throw new Error('Supabase configuration missing');
    }

    this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    if (supabaseServiceKey) {
      this.supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.logger.log('Supabase admin client initialized successfully.');
    }

    this.logger.log('Supabase client initialized successfully.');
  }

  getClient(): SupabaseClient {
    return this.supabaseClient;
  }

  getAdminClient(): SupabaseClient {
    if (!this.supabaseAdminClient) {
      throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.');
    }
    return this.supabaseAdminClient;
  }

  getUserClient(token: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY') || this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Key is missing');
    }

    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
}
