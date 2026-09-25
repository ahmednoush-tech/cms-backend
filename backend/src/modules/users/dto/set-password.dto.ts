import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password-strength.validator';

export class SetPasswordDto {
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  newPassword: string;
}
