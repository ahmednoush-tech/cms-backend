import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTimeEntryDto {
  @IsDateString()
  @IsOptional()
  entryDate?: string;

  @IsNumber()
  @Min(0.01)
  @Max(24)
  @IsOptional()
  hours?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  billable?: boolean;

  // Deliberately no `taskId` or `employeeId` — reassigning a
  // logged entry to a different task or employee after the fact
  // is a correction significant enough that deleting and
  // re-creating it is clearer than an in-place identity change.
}
