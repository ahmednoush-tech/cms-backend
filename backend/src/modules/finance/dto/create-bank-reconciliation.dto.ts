import { IsDateString, IsNumber, IsUUID } from 'class-validator';

export class CreateBankReconciliationDto {
  @IsUUID()
  bankAccountId: string;

  @IsDateString()
  statementDate: string;

  @IsNumber()
  statementEndingBalance: number;
}
