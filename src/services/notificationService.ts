import { INotificationProvider } from 'providers/notifications/INotificationProvider';
import { NotificationSubscriptionModel } from '../models/notificationSubscription';
import { INotificationPayload } from '../types';
import { INotificationSubscription } from 'types';
import { shouldNotifyNow } from 'utils/quietHours';
import { WebPushProvider } from 'providers/notifications/WebNotification';
import logger from 'utils/logger';

class NotificationService {
  private providers: Map<string, INotificationProvider>;

  constructor() {
    this.providers = new Map();
    // Registra os provedores disponíveis. Para adicionar um novo (ex: FCM), basta adicionar uma linha aqui.
    this.providers.set('web', new WebPushProvider());
    // this.providers.set('android', new FcmProvider()); // Exemplo de como seria extensível
    // this.providers.set('ios', new ApnProvider());     // Exemplo de como seria extensível
  }

  /**
   * Cria ou atualiza uma assinatura de notificação para um usuário/dispositivo.
   * Utiliza um "upsert" para garantir que não haja duplicatas.
   * @param data - Os dados da assinatura.
   * @returns A assinatura criada ou atualizada.
   */
  public async subscribe(data: Partial<INotificationSubscription>): Promise<INotificationSubscription> {
    const { user, deviceIdentifier, platform } = data;
    if (!user || !deviceIdentifier) {
      throw new Error('User ID e Device Identifier são obrigatórios.');
    }

    const subscription = await NotificationSubscriptionModel.findOneAndUpdate(
      { user, deviceIdentifier, platform },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );
    return subscription;
  }

  /**
   * Envia uma notificação para um ou mais usuários, respeitando suas preferências.
   * @param userIds - Array de IDs dos usuários que receberão a notificação.
   * @param payload - O conteúdo da notificação (título, corpo, categoria, etc.).
   */
  public async sendNotification(userIds: string[], payload: INotificationPayload): Promise<void> {
    const alwaysAllowedFilter = {
      notificationsKinds: {
        security: true,
        system: true
      },
      isPermissionGranted: { $in: [true, false] }
    };
    const regularFilter = {
      isPermissonGranted: true
    }

    const isCriticalNotification = payload.category === 'security' || payload.category === 'system';
    const filter = isCriticalNotification ? alwaysAllowedFilter : regularFilter;
    const subscriptions = await NotificationSubscriptionModel.find({
      user: { $in: userIds },
      ...filter
    });

    for (const sub of subscriptions) {
      if (!this.shouldSend(sub, payload)) {
        continue; // Pula se as preferências do usuário não permitirem
      }

      const provider = this.providers.get(sub.platform);
      if (provider) {
        await provider.send(sub, payload);
      } else {
        logger.warn(`Nenhum provedor de notificação encontrado para a plataforma: ${sub.platform}`);
      }
    }
  }

  /**
   * Centraliza a lógica de negócio para decidir se uma notificação deve ser enviada,
   * com base nas preferências do usuário.
   * @param sub - A assinatura do usuário.
   * @param payload - O conteúdo da notificação.
   * @returns `true` se a notificação deve ser enviada, `false` caso contrário.
   */
  private shouldSend(sub: INotificationSubscription, payload: INotificationPayload): boolean {
    // 1. Verifica a categoria
    if (!sub.notificationsKinds[payload.category]) {
      return false;
    }

    if (!sub.preferences || sub.preferences.weekMask === 0) {
      return false;
    }

    const prefs = {
      startMinute: sub.preferences.startMinute,
      endMinute: sub.preferences.endMinute,
      weekMask: sub.preferences.weekMask,
      timezone: sub.preferences.timezone
    };
    const canNotify = shouldNotifyNow(new Date(), prefs);

    if (!canNotify) {
      return false;
    }

    return true;
  }
}

export default new NotificationService();
