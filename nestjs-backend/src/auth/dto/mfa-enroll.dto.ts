import { IsOptional, IsString } from 'class-validator';

export class MfaEnrollDto {
  @IsOptional()
  @IsString()
  friendlyName?: string;
}
