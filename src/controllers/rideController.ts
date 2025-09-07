import { Request, Response } from 'express';
import { rideService } from 'services/rideService';
import { Types } from 'mongoose';

class RideController {
  /**
   * Cria uma carona única.
   */
  public async create(req: Request, res: Response): Promise<Response> {
    try {
      const ride = await rideService.createRide(req.user!._id, req.body);
      return res.status(201).json(ride);
    } catch (error: Error | any) {
      return res.status(400).json({ message: error.message });
    }
  }

  /**
   * Cria caronas recorrentes.
   */
  public async createRecurrent(req: Request, res: Response): Promise<Response> {
    try {
      const rides = await rideService.createRecurrentRide(req.user!._id, req.body);
      return res.status(201).json(rides);
    } catch (error: Error | any) {
      return res.status(400).json({ message: error.message });
    }
  }

  /**
   * Busca caronas disponíveis com base em critérios.
   */
  public async search(req: Request, res: Response): Promise<Response> {
    try {
      const rides = await rideService.searchRides(req.query, req.user!._id);
      return res.status(200).json(rides);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao buscar caronas.', error: error.message });
    }
  }

  /**
   * Lista as caronas do usuário logado como motorista.
   */
  public async getMyRidesAsDriver(req: Request, res: Response): Promise<Response> {
    try {
      const rides = await rideService.getMyRidesAsDriver(req.user!._id);
      return res.status(200).json(rides);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao buscar suas caronas como motorista.', error: error.message });
    }
  }

  /**
   * Lista as caronas do usuário logado como caroneiro.
   */
  public async getMyRidesAsPassenger(req: Request, res: Response): Promise<Response> {
    try {
      const rides = await rideService.getMyRidesAsPassenger(req.user!._id);
      return res.status(200).json(rides);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao buscar suas caronas como caroneiro.', error: error.message });
    }
  }

  /**
   * Obtém os detalhes de uma carona específica.
   */
  public async getDetails(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const rideDetails = await rideService.getRideDetails(id as unknown as Types.ObjectId, req.user!._id);
      return res.status(200).json(rideDetails);
    } catch (error: Error | any) {
      // Usa 403 (Proibido) se o usuário não tiver permissão para ver
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Atualiza os dados de uma carona.
   */
  public async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const ride = await rideService.updateRide(id as unknown as Types.ObjectId, req.user!._id, req.body);
      return res.status(200).json(ride);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Permite que um caroneiro solicite uma vaga em uma carona.
   */
  public async requestSeat(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const ride = await rideService.requestSeat(id as unknown as Types.ObjectId, req.user!._id);
      return res.status(200).json(ride);
    } catch (error: Error | any) {
      return res.status(400).json({ message: error.message });
    }
  }

  /**
   * Permite que um motorista aprove ou rejeite uma solicitação de vaga.
   */
  public async manageSeatRequest(req: Request, res: Response): Promise<Response> {
    try {
      const { id, passengerId } = req.params;
      const { action } = req.body; // 'approve' ou 'reject'
      const ride = await rideService.manageSeatRequest(
        id as unknown as Types.ObjectId,
        req.user!._id,
        passengerId as unknown as Types.ObjectId,
        action);
      return res.status(200).json(ride);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Permite que o motorista cancele a carona.
   */
  public async cancelByDriver(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const ride = await rideService.cancelRideByDriver(id as unknown as Types.ObjectId, req.user!._id);
      return res.status(200).json({ message: 'Carona cancelada com sucesso.', ride });
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Permite que o caroneiro cancele sua reserva.
   */
  public async cancelByPassenger(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const ride = await rideService.cancelSeatByPassenger(id as unknown as Types.ObjectId, req.user!._id);
      return res.status(200).json({ message: 'Reserva cancelada com sucesso.', ride });
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }
}

export const rideController = new RideController();
