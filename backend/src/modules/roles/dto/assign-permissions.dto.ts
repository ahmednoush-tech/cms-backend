import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsUUID } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ type: [String], description: 'permissions.id values' })
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
