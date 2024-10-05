import { Router } from 'express';
import * as authCtrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', authCtrl.login);
router.post('/refresh', authCtrl.refresh);
router.post('/logout', authCtrl.logout);
router.get('/me', authenticate, authCtrl.getMe);
router.put('/profile', authenticate, authCtrl.updateProfile);
router.put('/password', authenticate, authCtrl.changePassword);

export default router;
