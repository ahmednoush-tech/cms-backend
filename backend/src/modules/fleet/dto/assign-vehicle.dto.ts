import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignVehicleDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  assignedDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
