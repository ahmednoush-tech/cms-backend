import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  invoiceId: string;

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

  @IsNumber()
  @IsOptional()
  @IsPositive()
  exchangeRateToBase?: number;
}
