import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CheckDuplicatesDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}
