import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  // Additional fields for Workers
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  // Additional fields for Vendors
  @IsOptional()
  @IsString()
  businessName?: string;
}
