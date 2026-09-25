import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn: number;
}

export class CurrentUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ required: false })
  employeeId?: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty()
  isCustomerUser: boolean;

  @ApiProperty({ required: false })
  customerId?: string;
}
