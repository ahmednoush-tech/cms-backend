import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class JournalEntryLineDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  debit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  credit?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
