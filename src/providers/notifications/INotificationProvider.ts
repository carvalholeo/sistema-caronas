import { INotificationPayload } from "types";
import { INotificationSubscription } from "types";

/**
 * Define o contrato que todo provedor de notificação (WebPush, FCM, etc.) deve seguir.
 */
export interface INotificationProvider {
  /**
   * Envia a notificação para uma assinatura específica.
   * @param subscription - A assinatura do dispositivo alvo.
   * @param payload - O conteúdo da notificação.
   * @returns Uma promessa que resolve quando o envio é concluído.
   */
  send(subscription: INotificationSubscription, payload: INotificationPayload): Promise<void>;
}
