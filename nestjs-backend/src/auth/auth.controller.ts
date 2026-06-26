import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { MfaEnrollDto } from './dto/mfa-enroll.dto';
import { MfaVerifyEnrollDto } from './dto/mfa-verify-enroll.dto';
import { MfaChallengeDto } from './dto/mfa-challenge.dto';
import { MfaUnenrollDto } from './dto/mfa-unenroll.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('mfa/enroll')
  @UseGuards(SupabaseAuthGuard)
  enrollMfa(@Req() req, @Body() body: MfaEnrollDto) {
    return this.authService.enrollMfa(req.user.token, body.friendlyName);
  }

  @Post('mfa/verify-enroll')
  @UseGuards(SupabaseAuthGuard)
  verifyEnrollMfa(@Req() req, @Body() body: MfaVerifyEnrollDto) {
    return this.authService.verifyEnrollMfa(req.user.token, body.factorId, body.code);
  }

  @Post('mfa/challenge')
  challengeMfa(@Body() body: MfaChallengeDto) {
    return this.authService.challengeAndVerifyMfa(body.accessToken, body.factorId, body.code);
  }

  @Post('mfa/unenroll')
  @UseGuards(SupabaseAuthGuard)
  unenrollMfa(@Req() req, @Body() body: MfaUnenrollDto) {
    return this.authService.unenrollMfa(req.user.token, body.factorId);
  }
}
