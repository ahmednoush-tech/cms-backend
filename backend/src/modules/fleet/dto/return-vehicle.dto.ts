import { IsDateString } from 'class-validator';

export class ReturnVehicleDto {
  @IsDateString()
  returnedDate: string;
}
