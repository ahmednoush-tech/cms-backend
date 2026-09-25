import { IsDateString } from 'class-validator';

export class StatementQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}
