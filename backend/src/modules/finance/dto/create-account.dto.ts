import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsIn(['asset', 'liability', 'equity', 'revenue', 'expense'])
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

  @IsIn(['debit', 'credit'])
  normalBalance: 'debit' | 'credit';

  @IsIn(['operating', 'investing', 'financing'])
  @IsOptional()
  cashFlowCategory?: 'operating' | 'investing' | 'financing';

  @IsIn(['long_term_liability', 'fixed_asset', 'long_term_investment'])
  @IsOptional()
  zakatCategory?: 'long_term_liability' | 'fixed_asset' | 'long_term_investment';

  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
