import { IsIn, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsString()
  @IsIn(['LIGHT', 'DARK'], { message: 'Theme must be either LIGHT or DARK' })
  theme: 'LIGHT' | 'DARK';
}
