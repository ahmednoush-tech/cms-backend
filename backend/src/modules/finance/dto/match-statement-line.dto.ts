import { IsUUID } from 'class-validator';

export class MatchStatementLineDto {
  @IsUUID()
  journalEntryLineId: string;
}
