import { Router } from 'express';
import { authController } from 'controllers/authController';
import { registerValidator, loginValidator, twoFactorValidator, requestResetValidator, completeResetValidator } from 'middlewares/validators/auth';
import { authMiddleware } from 'middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';

const authRouter = Router();

authRouter.post('/register', registerValidator, requestValidator, authController.register);
authRouter.post('/login', loginValidator, requestValidator, authController.login);

authRouter.post('/password/reset', requestResetValidator, registerValidator, authController.requestReset);
authRouter.post('/password/reset/complete', completeResetValidator, requestValidator, authController.completeReset);

authRouter.use(authMiddleware);
authRouter.post('/2fa/generate', requestValidator, authController.generate2FA);
authRouter.post('/2fa/verify', twoFactorValidator, requestValidator, authController.verify2FA);

export default authRouter;
