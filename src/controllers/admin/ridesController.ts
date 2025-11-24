import { Request, Response } from 'express';
import { adminRidesService } from '../../services/admin/rideService';
import { IRide } from '../../types';
import { IAdminListRidesQuery } from '@/types/requests/admin/rides';

class AdminRidesController {
  /**
   * Lista todas as caronas do sistema com base em filtros.
   */
  public async listRides(req: Request, res: Response): Promise<Response> {
    try {
      const query: IAdminListRidesQuery = req.query;
      const rides = await adminRidesService.listRides(query);
      return res.status(200).json(rides);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao listar caronas.', error: error.message });
    }
  }

  /**
   * Obtém os detalhes completos de uma carona específica.
   */
  public async getRideDetails(req: Request, res: Response): Promise<Response> {
    try {
      const rideId: IRide = req.params.rideId as unknown as IRide;
      const adminUser = req.user!;
      const rideDetails = await adminRidesService.getRideDetails(
        rideId,
        adminUser
      );
      return res.status(200).json(rideDetails);
    } catch (error: Error | any) {
      return res.status(404).json({ message: error.message });
    }
  }

  /**
   * Atualiza os dados de uma carona existente.
   */
  public async updateRide(req: Request, res: Response): Promise<Response> {
    try {
      const rideId: IRide = req.params.rideId as unknown as IRide;
      const { reason, ...updateData } = req.body;
      const adminUser = req.user!;
      const updatedRide = await adminRidesService.updateRide(
        rideId,
        adminUser,
        reason,
        updateData
      );
      return res.status(200).json(updatedRide);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Cancela uma carona em nome do motorista.
   */
  public async cancelRide(req: Request, res: Response): Promise<Response> {
    try {
      const rideId: IRide = req.params.rideId as unknown as IRide;
      const { reason } = req.body;
      const adminUser = req.user!;
      const cancelledRide = await adminRidesService.cancelRide(
        rideId,
        adminUser,
        reason);
      return res.status(200).json(cancelledRide);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Força a publicação de uma carona que estava pendente de moderação.
   */
  public async forcePublishRide(req: Request, res: Response): Promise<Response> {
    try {
      const rideId: IRide = req.params.rideId as unknown as IRide;
      const { reason } = req.body;
      const adminUser = req.user!;
      const publishedRide = await adminRidesService.forcePublishRide(
        rideId,
        adminUser,
        reason);
      return res.status(200).json(publishedRide);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }
}

export const adminRidesController = new AdminRidesController();
