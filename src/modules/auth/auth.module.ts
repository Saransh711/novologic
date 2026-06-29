import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GqlAuthGuard } from '../../common/auth/gql-auth.guard';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { TokenService } from './application/token.service';
import { AuthResolver } from './interface/auth.resolver';
import { CookieService } from './interface/cookies';

@Module({
  // Secrets/expiry are passed per sign/verify call (separate access/refresh
  // secrets), so the module registers with no global signing defaults.
  imports: [JwtModule.register({})],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    CookieService,
    AuthResolver,
    GqlAuthGuard,
  ],
  exports: [AuthService, GqlAuthGuard],
})
export class AuthModule {}
