import { INotificationProvider } from 'providers/notifications/INotificationProvider';
import { NotificationSubscriptionModel } from 'models/notificationSubscription';
import { INotificationPayload, IUpdatePreferencesData, IUser, INotificationSubscription } from 'types';
import { shouldNotifyNow } from 'utils/quietHours';
import { WebPushProvider } from 'providers/notifications/WebPushProvider';
import logger from 'utils/logger';
import { AndroidProvider } from 'providers/notifications/AndroidProvider';
import { IosProvider } from 'providers/notifications/IosProvider';
import { EmailProvider } from 'providers/notifications/EmailProvider';
import { NotificationEventModel } from 'models/event';
import { Types } from 'mongoose';
import { NotificationScope } from 'types/enums/enums';
import { SuppressedNotificationModel } from 'models/suppressedNotification';

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
    } else if (preferencesData.quietHours) {
      // Usa os métodos do schema para converter e salvar os dados corretamente
      const { startHour, endHour, weekDays, timezone } = preferencesData.quietHours;
      const weekMask = subscription?.preferences?.daysToMask(weekDays);

      subscription?.preferences?.convertHourToDatabase({
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
  public async sendNotification(userIds: IUser[], payload: INotificationPayload): Promise<void> {
    const isCriticalNotification = payload.category === 'security' || payload.category === 'system';

    for (const userId of userIds) {
      const allSubscriptions = await NotificationSubscriptionModel.find({ user: userId._id });
      if (allSubscriptions.length === 0) continue;

      let pushSentToActiveDevice = false;

      for (const sub of allSubscriptions) {
        if (sub.platform === 'email') continue;

        if (this.shouldSend(sub, payload)) {
          // A lógica de envio e log agora está em um método separado
          const wasSent = await this.sendAndLogNotification(sub, payload);
          if (wasSent && sub.isPermissionGranted) {
            pushSentToActiveDevice = true;
          }
        } else {
          await new SuppressedNotificationModel({ user: userId._id, reason: 'Envio de notificação não permitida no canal/horário.'}).save();
        }
      }

      if (isCriticalNotification && !pushSentToActiveDevice) {
        const emailSubscription = allSubscriptions.find(s => s.platform === 'email');
        if (emailSubscription) {
          logger.info(`Fallback: Enviando notificação crítica por e-mail para o usuário ${userId}`);
          await this.sendAndLogNotification(emailSubscription, payload);
        }
      }
    }
  }

  /**
   * Orquestra o envio e o registro do log para uma única subscrição.
   * @param sub - A subscrição do destinatário.
   * @param payload - O conteúdo da notificação.
   * @returns `true` se o envio foi bem-sucedido, `false` caso contrário.
   */
  private async sendAndLogNotification(sub: INotificationSubscription, payload: INotificationPayload): Promise<boolean> {
    const provider = this.providers.get(sub.platform);
    if (!provider) {
      return false;
    }

    const notificationEventLog = {
      scope: NotificationScope.General,
      subscription: sub._id as Types.ObjectId,
      category: payload.category,
      statusHistory: [{
        status: 'sent',
        timestamp: new Date(),
        details: ''
      }],
      payload: JSON.stringify({ title: payload.title, body: payload.body }),
      isAggregated: false,
      isCritical: payload.category === 'security' || payload.category === 'system'
    }

    try {
      // 1. Cria o registro do evento ANTES de tentar enviar.
      await new NotificationEventModel(notificationEventLog).save();
      await provider.send(sub, payload);

      notificationEventLog.statusHistory[0].status = 'delivered';
      notificationEventLog.statusHistory[0].timestamp = new Date();
      await new NotificationEventModel(notificationEventLog).save();

      return true;
    } catch (error) {
      notificationEventLog.statusHistory[0].status = 'failed';
      notificationEventLog.statusHistory[0].details = (error as Error).message;
      notificationEventLog.statusHistory[0].timestamp = new Date();
      notificationEventLog.payload = '';

      await new NotificationEventModel(notificationEventLog).save();

      return false;
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
    const isCriticalNotification = payload.category === 'security' || payload.category === 'system';
    // Se for uma notificação crítica, ignore todas as outras preferências do usuário e envie.
    if (isCriticalNotification) {
      return sub.isPermissionGranted;
    }

    if (!sub.isPermissionGranted) {
      return false;
    }

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

    return shouldNotifyNow(new Date(), prefs);
  }
}

export default new NotificationService();
