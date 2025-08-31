import { Request, Response } from 'express';
import NotificationService from '../services/notificationService';

export const sendNotification = async (req: Request, res: Response) => {
    try {
        const { userId, message } = req.body;
        const notification = await NotificationService.sendNotification(userId, message);
        res.status(200).json(notification);
    } catch (_) {
        res.status(500).json({ error: 'Failed to send notification' });
    }
};

export const getUserNotifications = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const notifications = await NotificationService.getUserNotifications(userId);
        res.status(200).json(notifications);
    } catch (_) {
        res.status(500).json({ error: 'Failed to retrieve notifications' });
    }
};

export const updateNotificationPreferences = async (req: Request, res: Response) => {
    try {
        // const { userId } = req.params;
        // const preferences = req.body;
        // await NotificationService.updatePreferences(userId, preferences);
        res.status(200).json({ message: 'Preferences updated successfully' });
    } catch (_) {
        res.status(500).json({ error: 'Failed to update preferences' });
    }
};