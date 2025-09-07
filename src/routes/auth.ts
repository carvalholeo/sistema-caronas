import { Router } from 'express';
import { authController } from 'controllers/authController';
import { registerValidator, loginValidator, twoFactorValidator } from 'middlewares/validators/auth';
import { authMiddleware } from 'middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';

const authRouter = Router();

authRouter.post('/register', registerValidator, requestValidator, authController.register);
authRouter.post('/login', loginValidator, requestValidator, authController.login);
authRouter.post('/2fa/generate', authMiddleware, requestValidator, authController.generate2FA);
authRouter.post('/2fa/verify', twoFactorValidator, authMiddleware, requestValidator, authController.verify2FA);

export default authRouter;
