import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  productName?: string;

  @IsOptional()
  @IsString()
  productTagline?: string;
}
