import { Request, Response } from 'express';
import { vehicleService } from '../services/vehicleService';

class VehicleController {
  public async create(req: Request, res: Response): Promise<Response> {
    try {
      const vehicle = await vehicleService.createVehicle(req.user!._id, req.body);
      return res.status(201).json(vehicle);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao cadastrar veículo.', error: error.message });
    }
  }

  public async getMyVehicles(req: Request, res: Response): Promise<Response> {
    try {
      const vehicles = await vehicleService.getVehiclesByOwner(req.user!._id);
      return res.status(200).json(vehicles);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao buscar veículos.', error: error.message });
    }
  }
}

export const vehicleController = new VehicleController();

