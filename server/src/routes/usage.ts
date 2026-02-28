import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getUsage, getCurrentMonth } from '../services/usage.js';

const router = Router();

router.get('/me', authMiddleware, (req: any, res: any) => {
  const month = getCurrentMonth();
  const usage = getUsage(req.userId, month);
  
  res.json({
    userId: req.userId,
    month,
    minutesUsed: usage?.minutesUsed || 0,
    updatedAt: usage?.updatedAt || null
  });
});

export default router;
