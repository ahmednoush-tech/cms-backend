import { IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AddStatementLineDto {
  @IsDateString()
  transactionDate: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  /** Positive = money in, negative = money out. */
  @IsNumber()
  amount: number;
}
