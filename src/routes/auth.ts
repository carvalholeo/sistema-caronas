import { Router } from 'express';
import { authController } from '../controllers/authController';
import { registerValidator, loginValidator, twoFactorValidator } from '../middlewares/validators/auth';
import { authMiddleware } from '../middlewares/auth';

const authRouter = Router();

authRouter.post('/register', registerValidator, authController.register);
authRouter.post('/login', loginValidator, authController.login);
authRouter.post('/2fa/generate', authMiddleware, authController.generate2FA);
authRouter.post('/2fa/verify', twoFactorValidator, authController.verify2FA);

export default authRouter;
