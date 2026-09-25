import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformAdminAuthService } from './platform-admin-auth.service';
import { PlatformAdminLoginDto } from './dto/platform-admin-login.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Deliberately its own top-level path (/api/v1/platform-admin/...),
 * never nested under /auth — this is a completely separate login
 * surface from tenant user authentication.
 *
 * @Public() is required here: the app's global JwtAuthGuard
 * (APP_GUARD in app.module.ts) would otherwise try to validate a
 * tenant 'jwt' strategy token before this handler ever runs — this
 * endpoint has no token to check yet, since logging in is the
 * whole point.
 */
@ApiTags('Platform Admin / Auth')
@Controller('api/v1/platform-admin/auth')
export class PlatformAdminAuthController {
  constructor(private platformAdminAuthService: PlatformAdminAuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: PlatformAdminLoginDto) {
    return this.platformAdminAuthService.login(dto.email, dto.password);
  }
}
