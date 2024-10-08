import { Router } from 'express';
import * as authCtrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import {
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/authValidator.js';

const router = Router();

router.post('/login', authRateLimiter, validateRequest(loginSchema), authCtrl.login);

router.post('/refresh', validateRequest(refreshSchema), authCtrl.refresh);
router.post('/logout', authCtrl.logout);
router.get('/me', authenticate, authCtrl.getMe);
router.put('/profile', authenticate, validateRequest(updateProfileSchema), authCtrl.updateProfile);
router.put('/password', authenticate, validateRequest(changePasswordSchema), authCtrl.changePassword);

export default router;
