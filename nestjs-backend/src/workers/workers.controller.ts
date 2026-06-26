import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('workers')
@UseGuards(SupabaseAuthGuard)
export class WorkersController {
  constructor(private workersService: WorkersService) {}

  @Post('seed')
  seed() {
    return this.workersService.seedMockData();
  }

  @Get('search')
  search(
    @Query('serviceId') serviceId: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('maxDistance') maxDistance?: string,
    @Query('minRating') minRating?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: 'rating' | 'distance' | 'price',
  ) {
    const latNum = lat !== undefined ? Number(lat) : undefined;
    const lngNum = lng !== undefined ? Number(lng) : undefined;
    const maxDistNum = maxDistance !== undefined ? Number(maxDistance) : undefined;
    const minRatingNum = minRating !== undefined ? Number(minRating) : undefined;
    const maxPriceNum = maxPrice !== undefined ? Number(maxPrice) : undefined;

    return this.workersService.searchWorkers(
      serviceId,
      latNum,
      lngNum,
      maxDistNum,
      minRatingNum,
      maxPriceNum,
      sortBy,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workersService.findOne(id);
  }
}
