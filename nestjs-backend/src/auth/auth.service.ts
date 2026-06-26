import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private supabaseService: SupabaseService) {}

  async signUp(signUpDto: SignUpDto) {
    const { email, password, name, role, phone, skills, businessName } = signUpDto;

    // 1. Sign up user in Supabase Auth
    const { data: authData, error: authError } = await this.supabaseService.getClient().auth.signUp({
      email,
      password,
    });

    if (authError) {
      this.logger.error(`Supabase Auth sign up failed: ${authError.message}`);
      throw new BadRequestException(authError.message);
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new InternalServerErrorException('User creation failed in Auth provider');
    }

    try {
      const adminClient = this.supabaseService.getAdminClient();

      // 2. Insert into public.users table
      const { error: userError } = await adminClient.from('users').insert({
        id: authUser.id,
        email,
        name,
        role,
        phone,
      });

      if (userError) {
        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      // 3. Insert into specific tables based on role
      if (role === 'WORKER') {
        const { error: workerError } = await adminClient.from('workers').insert({
          id: authUser.id,
          skills: skills || [],
          rating: 5.0,
        });
        if (workerError) {
          throw new Error(`Failed to create worker profile: ${workerError.message}`);
        }
      } else if (role === 'VENDOR') {
        const { error: vendorError } = await adminClient.from('vendors').insert({
          id: authUser.id,
          business_name: businessName || `${name}'s Shop`,
        });
        if (vendorError) {
          throw new Error(`Failed to create vendor profile: ${vendorError.message}`);
        }
      }

      return {
        message: 'Registration successful',
        userId: authUser.id,
      };
    } catch (dbError) {
      this.logger.error(`Database insertion failed: ${dbError.message}. Rolling back auth user.`);
      // Rollback: delete the auth user using admin client
      await this.supabaseService.getAdminClient().auth.admin.deleteUser(authUser.id);
      throw new InternalServerErrorException(dbError.message);
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Sign in using Supabase client
    const { data, error } = await this.supabaseService.getClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      this.logger.error(`Supabase Auth login failed: ${error.message}`);
      throw new BadRequestException('Invalid credentials');
    }

    // Retrieve user profile to check role
    const { data: userProfile, error: profileError } = await this.supabaseService
      .getAdminClient()
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !userProfile) {
      this.logger.warn(`Could not retrieve user profile for log in: ${profileError?.message}`);
    }

    // Check if the user has any verified MFA factors
    const factors = data.user?.factors || [];
    const totpFactors = factors.filter(f => f.factor_type === 'totp' && f.status === 'verified');
    if (totpFactors.length > 0) {
      return {
        message: 'Multi-Factor Authentication required',
        mfaRequired: true,
        accessToken: data.session.access_token, // temporary AAL1 token
        factorId: totpFactors[0].id,
      };
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userProfile?.name || '',
        role: userProfile?.role || 'HOUSEHOLD',
      },
    };
  }

  async enrollMfa(token: string, friendlyName?: string) {
    const userClient = this.supabaseService.getUserClient(token);

    const { data, error } = await userClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: friendlyName || 'Google Authenticator',
      issuer: 'ConnectChain',
    });

    if (error) {
      this.logger.error(`MFA enrollment failed: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async verifyEnrollMfa(token: string, factorId: string, code: string) {
    const userClient = this.supabaseService.getUserClient(token);

    // 1. Challenge the factor
    const { data: challengeData, error: challengeError } = await userClient.auth.mfa.challenge({ factorId });
    if (challengeError) {
      this.logger.error(`MFA verification challenge failed: ${challengeError.message}`);
      throw new BadRequestException(challengeError.message);
    }

    // 2. Verify the code
    const { data: verifyData, error: verifyError } = await userClient.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      this.logger.error(`MFA verification failed: ${verifyError.message}`);
      throw new BadRequestException(verifyError.message);
    }

    return verifyData;
  }

  async challengeAndVerifyMfa(accessToken: string, factorId: string, code: string) {
    const userClient = this.supabaseService.getUserClient(accessToken);

    // 1. Challenge
    const { data: challengeData, error: challengeError } = await userClient.auth.mfa.challenge({ factorId });
    if (challengeError) {
      this.logger.error(`MFA login challenge failed: ${challengeError.message}`);
      throw new BadRequestException(challengeError.message);
    }

    // 2. Verify
    const { data: verifyData, error: verifyError } = await userClient.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      this.logger.error(`MFA login verification failed: ${verifyError.message}`);
      throw new BadRequestException(verifyError.message);
    }

    return {
      accessToken: verifyData.access_token,
      refreshToken: verifyData.refresh_token,
      expiresIn: verifyData.expires_in,
    };
  }

  async unenrollMfa(token: string, factorId: string) {
    const userClient = this.supabaseService.getUserClient(token);

    const { data, error } = await userClient.auth.mfa.unenroll({ factorId });

    if (error) {
      this.logger.error(`MFA unenrollment failed: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return data;
  }
}
