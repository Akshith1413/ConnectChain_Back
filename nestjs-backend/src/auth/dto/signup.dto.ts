import { IsArray, IsEnum, IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class SignUpDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#)',
  })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @IsEnum(UserRole, { message: 'Role must be HOUSEHOLD, WORKER, or VENDOR' })
  role: UserRole;

  @IsOptional()
  @IsString()
  phone?: string;

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
