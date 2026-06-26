import { IsString } from 'class-validator';

export class MfaUnenrollDto {
  @IsString()
  factorId: string;
}
