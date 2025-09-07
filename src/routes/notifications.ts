import { Router } from 'express';
import { notificationController } from 'controllers/notificationController';
import { authMiddleware } from 'middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';
import { subscribeValidator, updatePreferencesValidator } from 'middlewares/validators/notification';

const notificationRouter = Router();

notificationRouter.use(authMiddleware);
notificationRouter.use(requestValidator);

// Route to get notifications for a user
/**
 * @route POST /api/notifications/subscribe
 * @description Regista um dispositivo para receber notificações.
 * @access Private
 */
notificationRouter.post(
  '/subscribe',
  subscribeValidator,
  notificationController.subscribe
);

/**
 * @route PATCH /api/notifications/subscriptions/:deviceIdentifier/preferences
 * @description Atualiza as preferências de notificação para um dispositivo específico.
 * @access Private
 */
notificationRouter.patch(
  '/subscriptions/:deviceIdentifier/preferences',
  updatePreferencesValidator,
  notificationController.updatePreferences
);

export default notificationRouter;
