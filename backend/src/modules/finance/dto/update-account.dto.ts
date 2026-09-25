import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Unlike code/type/normalBalance/parentId (see below),
  // cashFlowCategory is safe to allow editing after journal
  // entries exist — it's a reporting tag consumed only by the
  // Cash Flow Statement, not part of the double-entry mechanics
  // that Trial Balance / Balance Sheet depend on. Correcting a
  // miscategorized account (e.g. "Bank Loan" wrongly tagged
  // operating instead of financing) should retroactively fix past
  // cash flow reports when regenerated, which is the desired
  // behavior, not a data-integrity risk.
  @IsIn(['operating', 'investing', 'financing'])
  @IsOptional()
  cashFlowCategory?: 'operating' | 'investing' | 'financing';

  // Same reasoning as cashFlowCategory above: a reporting tag
  // consumed only by the Zakat Base estimate, safe to edit
  // anytime, not part of double-entry mechanics.
  @IsIn(['long_term_liability', 'fixed_asset', 'long_term_investment'])
  @IsOptional()
  zakatCategory?: 'long_term_liability' | 'fixed_asset' | 'long_term_investment';

  // Deliberately no `code`, `type`, `normalBalance`, or `parentId`
  // here — changing an account's code/type/normal-balance/parent
  // after journal entries have posted against it would silently
  // corrupt historical reports. An account with the wrong
  // classification should be deactivated (isActive: false) and a
  // replacement created, not mutated in place — standard
  // accounting-software practice, not an oversight.
}
