import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateBillPaymentDto {
  @IsUUID()
  billId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsIn(['cash', 'bank_transfer', 'card', 'cheque', 'other'])
  method: 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other';

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reference?: string;
}
