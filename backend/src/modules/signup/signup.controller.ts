import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SignupService } from './signup.service';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public / Signup')
@Public()
@Controller('api/v1/signup')
export class SignupController {
  constructor(private signupService: SignupService) {}

  @Post()
  signup(@Body() dto: SignupDto) {
    return this.signupService.signup(dto);
  }
}
