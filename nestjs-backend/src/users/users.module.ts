import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ServicesModule } from '../services/services.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [ServicesModule, BookingsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
