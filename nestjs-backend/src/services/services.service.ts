import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private supabaseService: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('services')
      .select('id, name, icon, description')
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch services: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve services: ${error.message}`);
    }

    return data || [];
  }

  async search(q: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('services')
      .select('id, name, icon, description')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to search services for query '${q}': ${error.message}`);
      throw new BadRequestException(`Failed to search services: ${error.message}`);
    }

    return data || [];
  }
}
