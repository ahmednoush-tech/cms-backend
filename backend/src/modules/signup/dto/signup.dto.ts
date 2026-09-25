import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password-strength.validator';

export class SignupDto {
  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  adminName: string;

  @IsEmail()
  adminEmail: string;

  /** Same minimum this system already enforces at login/reset — see auth/dto/login.dto.ts. */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @IsStrongPassword()
  adminPassword: string;
}
