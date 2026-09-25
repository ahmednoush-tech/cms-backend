import { IsDateString } from 'class-validator';

export class AsOfDateQueryDto {
  @IsDateString()
  asOfDate: string;
}

export class DateRangeQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}
