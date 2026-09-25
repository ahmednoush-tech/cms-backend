import { IsOptional, IsUUID } from 'class-validator';

export class UpdatePayrollSettingsDto {
  @IsUUID()
  @IsOptional()
  salaryExpenseAccountId?: string;

  @IsUUID()
  @IsOptional()
  gosiEmployerExpenseAccountId?: string;

  @IsUUID()
  @IsOptional()
  gosiPayableAccountId?: string;

  @IsUUID()
  @IsOptional()
  netPayPayableAccountId?: string;
}
