import apn from 'node-apn-flitto';
import { INotificationProvider } from './INotificationProvider';
import { INotificationPayload, INotificationSubscription } from 'types';
import { NotificationSubscriptionModel } from 'models/notificationSubscription';
import logger from 'utils/logger';

export class IosProvider implements INotificationProvider {
  private apnProvider: apn.Provider;

  constructor() {
    // As credenciais DEVEM vir de variáveis de ambiente.
    const options = {
      token: {
        key: process.env.APNS_KEY_PATH!, // Caminho para o seu ficheiro .p8
        keyId: process.env.APNS_KEY_ID!,
        teamId: process.env.APNS_TEAM_ID!,
      },
      production: process.env.NODE_ENV === 'production',
    };

    this.apnProvider = new apn.Provider(options);
  }

  public async send(subscription: INotificationSubscription, payload: INotificationPayload): Promise<void> {
    if (!subscription.destination) {
      logger.warn(`Tentativa de envio via APNS sem deviceToken para o utilizador ${subscription.user}`);
      return;
    }

    const note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expira em 1 hora
    note.badge = 1;
    note.sound = 'ping.aiff';
    note.alert = {
      title: payload.title,
      body: payload.body,
    };
    note.topic = process.env.APNS_BUNDLE_ID!; // O Bundle ID da sua aplicação iOS
    note.payload = {
      category: payload.category,
      url: payload.url || '',
    };

    try {
      const result = await this.apnProvider.send(note, subscription.destination);

      // Verifica se houve falhas e se a causa foi um token inválido.
      if (result.failed && result.failed.length > 0) {
        for (const failure of result.failed) {
          if (failure.status === 410 || (failure.response && failure.response.reason === 'Unregistered')) {
            logger.warn(`Token APNS inválido para ${failure.device}. A remover.`);
            await NotificationSubscriptionModel.deleteOne({ deviceToken: failure.device });
          } else {
            logger.error('Falha ao enviar notificação APNS:', failure);
          }
        }
      }
    } finally {
      // Encerra a conexão após o envio.
      this.apnProvider.shutdown();
    }
  }
}
