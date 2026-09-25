import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Creates a brand-new portal login (users row) and links it to
 * the given customer via customer_users in one step — the
 * common case ("give this contact a portal login").
 */
export class CreateCustomerUserDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Plain password — hashed server-side' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false, description: 'customer_contacts.id to associate this login with' })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}

/**
 * Links an EXISTING users row (e.g. one already created via
 * Administration, or a former employee account) to a customer.
 * Rare path — most customer users are created via CreateCustomerUserDto.
 */
export class LinkExistingUserDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}
