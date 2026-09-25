import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMicrosoftIntegrationDto {
  @IsString()
  @MinLength(1)
  clientId: string;

  /** Optional — omit to leave the previously saved secret unchanged. */
  @IsString()
  @IsOptional()
  @MinLength(1)
  clientSecret?: string;
}
