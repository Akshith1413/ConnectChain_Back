import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const { data: { user }, error } = await this.supabaseService.getClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Decode JWT payload to get current Authenticator Assurance Level (AAL)
    let aal = 'aal1';
    try {
      const payloadBase64 = token.split('.')[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      aal = payload.aal || 'aal1';
    } catch (e) {
      // ignore parsing error
    }

    // If the user has any verified TOTP factors, require AAL2 for non-MFA-enrollment endpoints
    const isMfaEnrollmentEndpoint = request.url.includes('/auth/mfa/enroll') || request.url.includes('/auth/mfa/verify-enroll');
    if (!isMfaEnrollmentEndpoint) {
      const verifiedFactors = user.factors?.filter(f => f.status === 'verified') || [];
      if (verifiedFactors.length > 0 && aal !== 'aal2') {
        throw new UnauthorizedException('MFA verification required (AAL2 level needed)');
      }
    }

    // Retrieve custom profile information (e.g. role) from public database
    const { data: profile } = await this.supabaseService
      .getAdminClient()
      .from('users')
      .select('role, name')
      .eq('id', user.id)
      .single();

    request.user = {
      id: user.id,
      email: user.email,
      name: profile?.name || '',
      role: profile?.role || 'HOUSEHOLD',
      token,
    };

    return true;
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
