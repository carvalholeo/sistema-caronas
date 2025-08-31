import Notification, { INotification } from '../models/notification';
import {UserModel as User} from '../models/user';

class NotificationService {
    async sendNotification(userId: string, message: string): Promise<void> {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const notification = new Notification({
            user: userId,
            message,
            read: false,
            createdAt: new Date(),
        });

        await notification.save();
    }

    async getUserNotifications(userId: string): Promise<INotification[]> {
        return await Notification.find({ user: userId }).sort({ createdAt: -1 });
    }

    async markNotificationAsRead(notificationId: string): Promise<void> {
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            throw new Error('Notification not found');
        }

        notification.isRead = true;
        await notification.save();
    }

    async deleteNotification(notificationId: string): Promise<void> {
        const result = await Notification.deleteOne({ _id: notificationId });
        if (result.deletedCount === 0) {
            throw new Error('Notification not found');
        }
    }
}

export default new NotificationService();