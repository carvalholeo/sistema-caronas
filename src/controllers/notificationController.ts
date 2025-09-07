import { Request, Response } from 'express';

import { IUpdatePreferencesData } from 'types';
import notificationService from '../services/notificationService';

class NotificationController {
  /**
   * Regista ou atualiza a subscrição de um dispositivo para notificações.
   */
  public async subscribe(req: Request, res: Response): Promise<Response> {
    try {
      // O ID do utilizador vem do token JWT, garantindo que um utilizador só pode subscrever o seu próprio dispositivo.
      const subscriptionData = {
        user: req.user!,
        ...req.body,
      };

      const newSubscription = await notificationService.subscribe(subscriptionData);
      return res.status(201).json(newSubscription);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao registar a subscrição de notificação.', error: error.message });
    }
  }

  /**
   * Atualiza as preferências de notificação para um dispositivo específico de um utilizador.
   */
  public async updatePreferences(req: Request, res: Response): Promise<Response> {
    try {
      const user = req.user!;
      const { deviceIdentifier } = req.params;
      const preferencesData: IUpdatePreferencesData = req.body;

      const updatedSubscription = await notificationService.updatePreferences(user, deviceIdentifier, preferencesData);
      return res.status(200).json(updatedSubscription);
    } catch (error: any) {
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Erro ao atualizar as preferências de notificação.', error: error.message });
    }
  }
}

export const notificationController = new NotificationController();
