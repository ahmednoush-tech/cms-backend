import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JournalEntryLineDto } from './journal-entry-line.dto';

export class UpdateJournalEntryDto {
  @IsDateString()
  @IsOptional()
  entryDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reference?: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Optional — if provided, REPLACES the entry's entire line set
  // (simpler and less error-prone than partial line patching for
  // a still-draft entry). Only reachable while status === 'draft'
  // — see JournalEntriesService.update().
  @IsArray()
  @ArrayMinSize(2, { message: 'A journal entry needs at least two lines (one debit, one credit).' })
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  @IsOptional()
  lines?: JournalEntryLineDto[];
}
