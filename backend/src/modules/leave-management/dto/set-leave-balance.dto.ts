import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

export class SetLeaveBalanceDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  leaveTypeId: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsNumber()
  @Min(0)
  allocatedDays: number;
}
