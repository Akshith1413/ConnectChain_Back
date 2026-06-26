import { IsISO8601, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty({ message: 'Service ID is required' })
  serviceId: string;

  @IsISO8601({}, { message: 'scheduledAt must be a valid ISO 8601 date string' })
  scheduledAt: string;

  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  price: number;
}
