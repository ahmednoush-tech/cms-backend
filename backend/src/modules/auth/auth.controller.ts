import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/interfaces/request-context.interface';
import { RefreshTokenPayload } from './strategies/refresh.strategy';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email + password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new pair' })
  async refresh(
    @Body() _dto: RefreshTokenDto,
    @Req() req: { user: RefreshTokenPayload },
  ) {
    return this.authService.refresh(req.user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    // Decode without verifying signature just to pull jti/exp for
    // denylisting; the refresh strategy already verified validity
    // when this token was last used, and revocation is safe even
    // for an expired token (it's a no-op past its own exp anyway).
    const decoded = AuthController.decodeUnsafe(dto.refreshToken);
    if (decoded?.jti && decoded?.exp) {
      await this.authService.logout(decoded.jti, decoded.exp);
    }
    return;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated identity/context' })
  async me(@CurrentUser() user: AuthContext) {
    return user;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always the same response, whether or not the email matched
    // an account — see AuthService.forgotPassword for why.
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a password reset using the emailed token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Your password has been reset. You can now log in with your new password.' };
  }

  private static decodeUnsafe(
    token: string,
  ): { jti?: string; exp?: number } | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
}
