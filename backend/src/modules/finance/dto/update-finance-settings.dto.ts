import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateFinanceSettingsDto {
  @IsUUID()
  @IsOptional()
  defaultReceivableAccountId?: string;

  @IsUUID()
  @IsOptional()
  defaultRevenueAccountId?: string;

  @IsUUID()
  @IsOptional()
  defaultTaxPayableAccountId?: string;

  @IsUUID()
  @IsOptional()
  defaultCashAccountId?: string;

  @IsUUID()
  @IsOptional()
  defaultPayableAccountId?: string;

  @IsUUID()
  @IsOptional()
  defaultExpenseAccountId?: string;

  @IsUUID()
  @IsOptional()
  defaultTaxRecoverableAccountId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  sellerName?: string;

  @Matches(/^\d{15}$/, { message: 'vatRegistrationNumber must be exactly 15 digits.' })
  @IsOptional()
  vatRegistrationNumber?: string;
}
