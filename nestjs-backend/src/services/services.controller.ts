import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('services')
@UseGuards(SupabaseAuthGuard)
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get()
  findAll() {
    return this.servicesService.findAll();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.servicesService.search(q || '');
  }
}
