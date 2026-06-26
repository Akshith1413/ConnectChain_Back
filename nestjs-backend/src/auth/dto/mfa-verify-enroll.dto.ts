import { IsString, Length } from 'class-validator';

export class MfaVerifyEnrollDto {
  @IsString()
  factorId: string;

  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code: string;
}
