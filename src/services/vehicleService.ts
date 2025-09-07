// Lógica de negócio para CRUD de veículos.
import { VehicleModel } from 'models/vehicle';
import { UserModel } from 'models/user';
import { Types } from 'mongoose';
import { IVehicle } from 'types';
import { VehicleStatus, UserRole } from 'types/enums/enums';

class VehicleService {
    public async createVehicle(ownerId: Types.ObjectId, vehicleData: any): Promise<IVehicle> {
        const { plate } = vehicleData;

        const existingVehicle = await VehicleModel.findOne({ plate, status: VehicleStatus.Active });
        let status = VehicleStatus.Active;
        if (existingVehicle) {
            status = VehicleStatus.Pending;
        }

        const vehicle = new VehicleModel({ ...vehicleData, owner: ownerId, status });
        await vehicle.save();

        // Promove a motorista se ainda não for
        await UserModel.updateOne({ _id: ownerId, roles: { $ne: UserRole.Motorista } }, { $addToSet: { roles: UserRole.Motorista } });

        return vehicle;
    }

    public async getVehiclesByOwner(ownerId: Types.ObjectId): Promise<IVehicle[]> {
        return VehicleModel.find({ owner: ownerId });
    }
}

export const vehicleService = new VehicleService();
