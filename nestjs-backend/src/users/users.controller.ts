import { Body, Controller, Delete, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req) {
    return this.usersService.getProfile(req.user.id, req.user.role);
  }

  @Patch('me')
  updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, req.user.role, updateProfileDto);
  }

  @Patch('me/preferences')
  updatePreferences(@Req() req, @Body() updatePreferencesDto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(req.user.id, req.user.role, updatePreferencesDto.theme);
  }

  @Get('me/dashboard')
  getDashboard(@Req() req) {
    return this.usersService.getDashboardData(req.user.id, req.user.role);
  }

  @Delete('me')
  deleteAccount(@Req() req) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
