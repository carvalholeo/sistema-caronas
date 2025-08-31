import { Router } from 'express';
import { sendNotification, getUserNotifications, updateNotificationPreferences } from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Route to send a notification
router.post('/', authMiddleware, sendNotification);

// Route to get notifications for a user
router.get('/:userId', authMiddleware, getUserNotifications);

// Route to update notification preferences
router.put('/preferences', authMiddleware, updateNotificationPreferences);

export default router;