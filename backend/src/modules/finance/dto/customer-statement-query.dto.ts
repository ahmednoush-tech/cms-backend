import { IsDateString, IsUUID } from 'class-validator';

export class CustomerStatementQueryDto {
  @IsUUID()
  customerId: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}
