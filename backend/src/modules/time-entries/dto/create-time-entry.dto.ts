import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateTimeEntryDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  employeeId: string;

  @IsDateString()
  entryDate: string;

  @IsNumber()
  @Min(0.01)
  @Max(24)
  hours: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  billable?: boolean;
}
