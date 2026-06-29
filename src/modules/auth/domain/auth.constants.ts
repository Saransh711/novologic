/**
 * Names of the httpOnly cookies that carry the access and refresh tokens. The
 * access cookie authorizes API calls; the refresh cookie is scoped to the
 * refresh path only so it is never sent on ordinary requests.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Path the refresh cookie is restricted to. The browser only attaches the
 * refresh token to GraphQL requests, which is where the `refreshToken` mutation
 * lives. (Scoping it tighter than the access cookie limits its exposure.)
 */
export const REFRESH_COOKIE_PATH = '/graphql';

/** Number of random bytes in the opaque refresh-token secret. */
export const REFRESH_TOKEN_BYTES = 48;
