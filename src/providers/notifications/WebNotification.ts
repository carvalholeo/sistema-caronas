import webpush from 'web-push';
import { INotificationProvider } from './INotificationProvider';
import { INotificationPayload } from 'types';
import { INotificationSubscription } from 'types';
import { NotificationSubscriptionModel } from 'models/notificationSubscription';

export class WebPushProvider implements INotificationProvider {
  constructor() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } else {
      console.warn('VAPID keys não configuradas para WebPushProvider.');
    }
  }

  public async send(subscription: INotificationSubscription, payload: INotificationPayload): Promise<void> {
    const subscriptionObject = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh!, auth: subscription.keys.auth! }
    };

    try {
      await webpush.sendNotification(subscriptionObject, JSON.stringify(payload));
    } catch (error: any) {
      // Se a assinatura for inválida, remove do banco de dados.
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`Assinatura WebPush para ${subscription.endpoint} é inválida. Removendo.`);
        await NotificationSubscriptionModel.deleteOne({ endpoint: subscription.endpoint });
      } else {
        console.error('Erro ao enviar notificação via WebPush:', error.message);
      }
    }
  }
}
