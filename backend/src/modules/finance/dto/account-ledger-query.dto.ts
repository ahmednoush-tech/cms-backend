import { IsDateString, IsUUID } from 'class-validator';

export class AccountLedgerQueryDto {
  @IsUUID()
  accountId: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}
