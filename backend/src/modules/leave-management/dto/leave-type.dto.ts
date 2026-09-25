import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsBoolean()
  requiresBalance?: boolean;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
