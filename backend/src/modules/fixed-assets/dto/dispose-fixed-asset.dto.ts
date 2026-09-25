import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class DisposeFixedAssetDto {
  @IsDateString()
  disposalDate: string;

  /** Defaults to 0 (e.g. scrapped, written off, given away with no payment received). */
  @IsNumber()
  @IsOptional()
  @Min(0)
  disposalProceeds?: number;
}
