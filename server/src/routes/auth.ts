import { Router } from 'express';
import { z } from 'zod';
import { verifyAppleToken, createSessionToken, createGenericSessionToken, verifySessionToken, registerEmailUser, verifyEmailUser, createEmailSessionToken, createGoogleUser, findOrCreateGoogleUser } from '../services/auth.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://kotolift.onrender.com/api/auth/google/callback';
const APP_URL = process.env.APP_URL || 'https://sumi.sumidev.com';

const appleAuthSchema = z.object({
  identityToken: z.string().min(1),
  authorizationCode: z.string().optional(),
  user: z.object({
    id: z.string().optional(),
    email: z.string().optional(),
    fullName: z.string().optional()
  }).optional()
});

router.post('/apple', async (req, res) => {
  try {
    const body = appleAuthSchema.parse(req.body);
    const { identityToken } = body;

    const appleUser = await verifyAppleToken(identityToken);

    const sessionToken = await createSessionToken(appleUser);

    res.json({
      token: sessionToken,
      user: {
        id: appleUser.id,
        email: appleUser.email,
        name: appleUser.name
      }
    });
  } catch (err: any) {
    console.error('Apple auth error:', err);
    
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors
      });
    }

    const statusCode = err.message?.includes('verification') ? 401 : 500;
    res.status(statusCode).json({
      error: err.message || 'Authentication failed'
    });
  }
});

// Google OAuth - Initiate auth
router.post('/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' });
    }

    // Generate state for security
    const state = `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    // Return the auth URL to the frontend
    res.json({
      authUrl: authUrl.toString(),
      state
    });
  } catch (err: any) {
    console.error('Google auth error:', err);
    res.status(500).json({
      error: err.message || 'Google authentication failed'
    });
  }
});

// Google OAuth - Handle callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Google OAuth error:', error);
      return res.redirect(`${APP_URL}?auth_error=${encodeURIComponent(String(error))}`);
    }

    if (!code || !state) {
      return res.redirect(`${APP_URL}?auth_error=Missing+auth+parameters`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: GOOGLE_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Google token exchange error:', errText);
      return res.redirect(`${APP_URL}?auth_error=Token+exchange+failed`);
    }

    const tokens = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    if (!userInfoResponse.ok) {
      return res.redirect(`${APP_URL}?auth_error=Failed+to+get+user+info`);
    }

    const googleUser = await userInfoResponse.json();

    // Find or create user in our database
    const user = await findOrCreateGoogleUser({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture
    });

    // Create session token
    const sessionToken = await createGenericSessionToken({
      id: user.id,
      email: user.email,
      name: user.name
    });

    // For a better UX, redirect with token that the frontend will handle
    // Also store in localStorage for the popup to pick up
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Signing you in...</title>
        </head>
        <body>
          <script>
            try {
              localStorage.setItem('google_auth_token', '${sessionToken}');
              localStorage.setItem('google_auth_user', JSON.stringify({
                id: '${user.id}',
                email: '${user.email}',
                name: '${user.name || ''}'
              }));
              window.opener.postMessage({ type: 'google_auth_success', token: '${sessionToken}' }, '*');
            } catch(e) {}
            // Also redirect the main window if opened in popup
            if (window.opener && window.opener.location) {
              window.opener.location.href = '${APP_URL}?auth_token=${sessionToken}&auth_name=${encodeURIComponent(user.name || '')}&auth_email=${encodeURIComponent(user.email || '')}';
            } else {
              window.location.href = '${APP_URL}?auth_token=${sessionToken}&auth_name=${encodeURIComponent(user.name || '')}&auth_email=${encodeURIComponent(user.email || '')}';
            }
          </script>
          <p>Signing you in...</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Google callback error:', err);
    res.redirect(`${APP_URL}?auth_error=${encodeURIComponent(err.message || 'Auth+failed')}`);
  }
});

// Google OAuth - Finish auth (called by frontend after redirect)
router.get('/google/verify', async (req, res) => {
  const { token, name, email } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify the session token
    const payload = await verifySessionToken(String(token));

    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      token: String(token),
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      }
    });
  } catch (err: any) {
    console.error('Google verify error:', err);
    res.status(401).json({ error: 'Token verification failed' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const payload = await verifySessionToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  res.json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name
    }
  });
});

const emailRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  rememberMe: z.boolean().optional()
});

router.post('/register', async (req, res) => {
  try {
    const body = emailRegisterSchema.parse(req.body);
    const { email, password, name, rememberMe } = body;

    const user = await registerEmailUser(email, password, name);

    const sessionToken = await createEmailSessionToken(user, rememberMe);

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err: any) {
    console.error('Email register error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors
      });
    }

    const isRegistered = err.message?.includes('registered');
    const statusCode = isRegistered ? 400 : 500;
    res.status(statusCode).json({
      error: err.message || 'Registration failed'
    });
  }
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional()
});

router.post('/login', async (req, res) => {
  try {
    const body = emailLoginSchema.parse(req.body);
    const { email, password, rememberMe } = body;

    const user = await verifyEmailUser(email, password);

    const sessionToken = await createEmailSessionToken(user, rememberMe);

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err: any) {
    console.error('Email login error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors
      });
    }

    const isInvalid = err.message?.includes('Invalid');
    const statusCode = isInvalid ? 401 : 500;
    res.status(statusCode).json({
      error: err.message || 'Login failed'
    });
  }
});

export default router;
