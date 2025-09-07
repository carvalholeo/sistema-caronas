import * as admin from 'firebase-admin';
import { INotificationProvider } from './INotificationProvider';
import { INotificationPayload, INotificationSubscription } from 'types';
import { NotificationSubscriptionModel } from 'models/notificationSubscription';
import logger from 'utils/logger';

export class AndroidProvider implements INotificationProvider {
  constructor() {
    // A inicialização do Firebase Admin SDK deve ser feita uma única vez na aplicação.
    // Geralmente no arquivo principal (app.ts ou server.ts).
    // O SDK busca automaticamente as credenciais da variável de ambiente GOOGLE_APPLICATION_CREDENTIALS.
    if (!admin.apps.length) {
      logger.warn('Firebase Admin SDK não inicializado. O FcmProvider pode não funcionar.');
    }
  }

  public async send(subscription: INotificationSubscription, payload: INotificationPayload): Promise<void> {
    if (!subscription.destination) {
      logger.warn(`Tentativa de envio via FCM sem deviceToken para o utilizador ${subscription.user}`);
      return;
    }

    const message: admin.messaging.Message = {
      token: subscription.destination,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        category: payload.category,
        url: payload.url || '',
      },
      android: {
        notification: {
          icon: payload.icon || 'stock_ticker_update',
          channelId: 'default_channel_id', // Crie canais no seu app Android
        },
      },
    };

    try {
      await admin.messaging().send(message);
    } catch (error: any) {
      // Se o token não for mais válido, removemos a subscrição.
      if (error.code === 'messaging/registration-token-not-registered') {
        logger.info(`Token FCM inválido para ${subscription.deviceIdentifier}. A remover.`);
        await NotificationSubscriptionModel.deleteOne({ _id: subscription._id });
      } else {
        logger.error('Erro ao enviar notificação via FCM:', error.message);
      }
    }
  }
}
