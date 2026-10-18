const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createSupabaseAuth({ url, publishableKey, fetchImpl = fetch }) {
  const baseUrl = url?.replace(/\/$/, '');
  const configured = Boolean(baseUrl && publishableKey);

  function inspectAccessToken(accessToken) {
    if (typeof accessToken !== 'string' || !accessToken.trim()) return 'missing_token';
    const segments = accessToken.split('.');
    if (segments.length !== 3 || segments.some((segment) => !segment)) return 'malformed_token';

    let claims;
    try {
      claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
    } catch {
      return 'malformed_token';
    }
    if (!claims || typeof claims !== 'object' || typeof claims.iss !== 'string' || typeof claims.exp !== 'number') {
      return 'malformed_token';
    }
    if (baseUrl && claims.iss !== `${baseUrl}/auth/v1`) return 'wrong_project_or_issuer';
    if (claims.exp <= Math.floor(Date.now() / 1000)) return 'expired_token';
    return 'candidate';
  }

  async function request(path, body, method) {
    if (!configured) {
      const error = new Error('Supabase Auth is not configured on this backend.');
      error.status = 503;
      error.code = 'AUTH_UNAVAILABLE';
      throw error;
    }
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/auth/v1/${path}`, {
        method: method || (body === undefined ? 'GET' : 'POST'),
        headers: {
          apikey: publishableKey,
          'Content-Type': 'application/json',
          ...(body?.accessToken ? { Authorization: `Bearer ${body.accessToken}` } : {}),
        },
        ...(method === 'GET' || body === undefined ? {} : { body: JSON.stringify(body.payload ?? body) }),
      });
    } catch {
      const error = new Error('Supabase Auth could not be reached.');
      error.status = 502;
      error.code = 'AUTH_SERVICE_UNREACHABLE';
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(typeof result.msg === 'string' ? result.msg : 'Supabase Auth rejected the request.');
      error.status = response.status === 400 || response.status === 422 ? 400 : response.status;
      error.code = typeof result.error_code === 'string' ? result.error_code : typeof result.code === 'string' ? result.code : 'AUTH_PROVIDER_REJECTED';
      error.retryAfter = response.headers?.get('Retry-After') || null;
      throw error;
    }
    return result;
  }

  return {
    inspectAccessToken,
    async verifyAccessToken(accessToken) {
      const user = await request('user', { accessToken }, 'GET');
      if (typeof user.id !== 'string' || typeof user.email !== 'string') {
        const error = new Error('Supabase Auth returned an invalid user.');
        error.status = 401;
        throw error;
      }
      return user;
    },
    signIn(email, password) {
      return request('token?grant_type=password', { payload: { email, password } });
    },
    signUp(name, email, password) {
      return request('signup', { payload: { email, password, data: { full_name: name } } });
    },
  };
}

function createAuthMiddleware(auth) {
  return async function requireAuthenticatedUser(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      const responseError = { code: 'AUTH_REQUIRED', message: 'Sign in to use this endpoint.' };
      if (process.env.NODE_ENV !== 'production') {
        responseError.diagnostic = authorization ? 'malformed_authorization_header' : 'missing_token';
        console.warn('[SIGNAL auth] request has no usable bearer token', { diagnostic: responseError.diagnostic });
      }
      return res.status(401).json({ error: responseError });
    }
    const diagnostic = typeof auth.inspectAccessToken === 'function' ? auth.inspectAccessToken(match[1]) : 'candidate';
    if (diagnostic !== 'candidate') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[SIGNAL auth] access token rejected before verification', { diagnostic });
      }
      const responseError = { code: 'INVALID_SESSION', message: 'Your session is invalid or expired. Sign in again.' };
      // This classification contains no credentials and lets clients distinguish
      // an issuer/project mismatch from an Auth verification rejection.
      responseError.diagnostic = diagnostic;
      return res.status(401).json({ error: responseError });
    }
    try {
      const user = await auth.verifyAccessToken(match[1]);
      req.auth = {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        // Only server-controlled app_metadata is trusted for roles.
        role: user.app_metadata?.role === 'reviewer' || user.app_metadata?.role === 'admin' ? user.app_metadata.role : 'user',
      };
      req.supabaseAccessToken = match[1];
      return next();
    } catch (error) {
      const rateLimited = error?.status === 429;
      const status = rateLimited ? 429 : Number.isInteger(error?.status) && error.status >= 500 ? error.status : 401;
      const category = rateLimited ? 'rate_limited' : status === 401 ? 'verification_failure' : 'verification_unavailable';
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[SIGNAL auth] Supabase access-token verification failed', {
          diagnostic: category,
          upstreamStatus: Number.isInteger(error?.status) ? error.status : undefined,
          upstreamCode: typeof error?.code === 'string' ? error.code : undefined,
        });
      }
      const responseError = rateLimited
        ? { code: 'AUTH_RATE_LIMITED', message: error.message || 'Supabase Auth rate limited the request.' }
        : status === 401
          ? { code: 'INVALID_SESSION', message: 'Your session is invalid or expired. Sign in again.' }
          : { code: 'AUTH_VERIFICATION_UNAVAILABLE', message: 'SIGNAL could not verify the session with Supabase Auth.' };
      responseError.diagnostic = category;
      if (rateLimited && error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
      return res.status(status).json({ error: responseError });
    }
  };
}

function validateCredentials(body, requireName = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Provide an object with credentials.';
  if (typeof body.email !== 'string' || body.email.length > 254 || !EMAIL_PATTERN.test(body.email)) return 'Enter a valid email address.';
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) return 'Password must be between 8 and 128 characters.';
  if (requireName && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) return 'Name is required and must be at most 100 characters.';
  return null;
}

module.exports = { createSupabaseAuth, createAuthMiddleware, validateCredentials };
