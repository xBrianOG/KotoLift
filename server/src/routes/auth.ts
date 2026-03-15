import { Router } from 'express';
import { z } from 'zod';
import { verifyAppleToken, createSessionToken, verifySessionToken, registerEmailUser, verifyEmailUser, createEmailSessionToken } from '../services/auth.js';

const router = Router();

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

    const sessionToken = createSessionToken(appleUser);

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

    res.status(401).json({
      error: err.message || 'Authentication failed'
    });
  }
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const payload = verifySessionToken(token);

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
  name: z.string().optional()
});

router.post('/register', async (req, res) => {
  try {
    const body = emailRegisterSchema.parse(req.body);
    const { email, password, name } = body;

    const user = await registerEmailUser(email, password, name);

    const sessionToken = createEmailSessionToken(user);

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

    res.status(401).json({
      error: err.message || 'Registration failed'
    });
  }
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/login', async (req, res) => {
  try {
    const body = emailLoginSchema.parse(req.body);
    const { email, password } = body;

    const user = await verifyEmailUser(email, password);

    const sessionToken = createEmailSessionToken(user);

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

    res.status(401).json({
      error: err.message || 'Login failed'
    });
  }
});

export default router;
