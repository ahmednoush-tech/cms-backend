import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateZatcaCsrDto {
  @IsIn(['compliance', 'production'])
  csidType: 'compliance' | 'production';

  @IsString()
  @MinLength(1)
  organizationUnitName: string;

  @IsOptional()
  @IsString()
  commonName?: string;
}
