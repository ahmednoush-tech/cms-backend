import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsUUID } from 'class-validator';

export class MarkNotificationsReadDto {
  @ApiProperty({ type: [String], description: 'notifications.id values belonging to the current user' })
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[];
}
