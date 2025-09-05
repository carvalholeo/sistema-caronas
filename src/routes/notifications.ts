import { Router } from 'express';
import { sendNotification, getUserNotifications, updateNotificationPreferences } from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';

const router = Router();

router.use(authMiddleware);
router.use(requestValidator);

// Route to send a notification
router.post('/', sendNotification);

// Route to get notifications for a user
router.get('/:userId', getUserNotifications);

// Route to update notification preferences
router.put('/preferences', updateNotificationPreferences);

export default router;