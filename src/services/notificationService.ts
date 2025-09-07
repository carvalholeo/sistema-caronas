import { INotificationProvider } from 'providers/notifications/INotificationProvider';
import { NotificationSubscriptionModel } from '../models/notificationSubscription';
import { INotificationPayload, IUpdatePreferencesData, IUser } from '../types';
import { INotificationSubscription } from 'types';
import { shouldNotifyNow } from 'utils/quietHours';
import { WebPushProvider } from 'providers/notifications/WebPushProvider';
import logger from 'utils/logger';
import { AndroidProvider } from 'providers/notifications/AndroidProvider';
import { IosProvider } from 'providers/notifications/IosProvider';
import { EmailProvider } from 'providers/notifications/EmailProvider';

class NotificationService {
  private providers: Map<string, INotificationProvider>;

  constructor() {
    this.providers = new Map();
    // Registra os provedores disponíveis. Para adicionar um novo (ex: FCM), basta adicionar uma linha aqui.
    this.providers.set('web', new WebPushProvider());
    this.providers.set('android', new AndroidProvider());
    this.providers.set('ios', new IosProvider());
    this.providers.set('email', new EmailProvider());
  }

  /**
   * Cria ou atualiza uma assinatura de notificação para um usuário/dispositivo.
   * Utiliza um "upsert" para garantir que não haja duplicatas.
   * @param data - Os dados da assinatura.
   * @returns A assinatura criada ou atualizada.
   */
  public async subscribe(data: Partial<INotificationSubscription>): Promise<INotificationSubscription> {
    const { user, deviceIdentifier } = data;
    if (!user || !deviceIdentifier) {
      throw new Error('User ID e Device Identifier são obrigatórios.');
    }

    const subscription = await NotificationSubscriptionModel.findOneAndUpdate(
      { user: user._id, deviceIdentifier },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );
    return subscription;
  }

  /**
   * NOVO: Atualiza as preferências de notificação para uma assinatura específica.
   * @param user - O ID do utilizador.
   * @param deviceIdentifier - O identificador único do dispositivo.
   * @param preferencesData - Os novos dados de preferência a serem aplicados.
   * @returns A assinatura atualizada.
   */
  public async updatePreferences(user: IUser, deviceIdentifier: string, preferencesData: IUpdatePreferencesData): Promise<INotificationSubscription> {
    const subscription = await NotificationSubscriptionModel.findOne({ user: user._id, deviceIdentifier });

    if (!subscription) {
      throw new Error('Assinatura de notificação não encontrada para este dispositivo.');
    }

    // Atualiza os tipos de notificação (kinds) se forem fornecidos
    if (preferencesData.kinds) {
      Object.assign(subscription.notificationsKinds, preferencesData.kinds);
    }

    // Atualiza as preferências de "Não Perturbe" (quiet hours)
    if (preferencesData.quietHours === null) {
      subscription.preferences = undefined;
    } else  if (preferencesData.quietHours) {
      // Usa os métodos do schema para converter e salvar os dados corretamente
      const { startHour, endHour, weekDays, timezone } = preferencesData.quietHours;
      const weekMask = subscription?.preferences?.daysToMask(weekDays);

      subscription?.preferences?.convertHourToDatabase( {
        startMinute: startHour,
        endMinute: endHour,
        weekMask: weekMask!,
        timezone,
      });
    }

    await subscription.save();
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
