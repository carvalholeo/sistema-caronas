import { RideModel } from '../models/ride';
import { IRide } from '../types'
import { VehicleModel } from '../models/vehicle';
import { randomUUID } from 'crypto';
import { RideViewEventModel, SearchEventModel } from 'models/event';
import { Types } from 'mongoose';
import { VehicleStatus, RideStatus, PassengerStatus } from 'types/enums/enums';

class RideService {
    public async createRide(driverId: Types.ObjectId, rideData: any): Promise<IRide> {
        const vehicle = await VehicleModel.findOne({ _id: rideData.vehicle, owner: driverId });
        if (!vehicle || vehicle.status !== VehicleStatus.Active) {
            throw new Error('Veículo inválido ou não pertence ao motorista.');
        }
        if (rideData.availableSeats > vehicle.capacity) {
            throw new Error('A quantidade de assentos excede a capacidade do veículo.');
        }
        const ride = new RideModel({ ...rideData, driver: driverId });
        await ride.save();
        return ride;
    }

    public async createRecurrentRide(driverId: Types.ObjectId, rideData: any): Promise<any[]> {
        const { vehicle: vehicleId, availableSeats, recurrence } = rideData;
        const vehicle = await VehicleModel.findOne({ _id: vehicleId, owner: driverId, status: VehicleStatus.Active });
        if (!vehicle) {
            throw new Error('Veículo inválido ou não pertence ao motorista.');
        }
        if (availableSeats > vehicle.capacity) {
            throw new Error('A quantidade de assentos excede a capacidade do veículo.');
        }

        const ridesToCreate = [];
        const recurrenceId = randomUUID();
        const currentDate = new Date(rideData.departureTime);
        const endDate = new Date(recurrence.endDate);

        while (currentDate <= endDate) {
            if (recurrence.daysOfWeek.includes(currentDate.getDay())) {
                const departure = new Date(currentDate);
                departure.setHours(new Date(rideData.departureTime).getHours(), new Date(rideData.departureTime).getMinutes());

                ridesToCreate.push({
                    ...rideData,
                    driver: driverId,
                    departureTime: departure,
                    isRecurrent: true,
                    recurrenceId: recurrenceId,
                    status: RideStatus.Scheduled,
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (ridesToCreate.length === 0) throw new Error('Nenhuma data válida para a recorrência.');

        return RideModel.insertMany(ridesToCreate);
    }

    /**
     * Busca por caronas e calcula as vagas disponíveis em uma única consulta otimizada.
     * @param searchParams - Os parâmetros de busca (from, to, date).
     * @param userId - O ID do usuário que está buscando.
     * @returns Uma lista de caronas com o campo 'remainingSeats' adicionado.
     */
    public async searchRides(searchParams: any, userId: Types.ObjectId): Promise<any[]> {
        const startTime = Date.now();
        const { from, to, date } = searchParams;
        const searchDate = new Date(date);

        // Constrói a pipeline de agregação
        const pipeline = [
            // Estágio 1: Encontrar as caronas que correspondem aos critérios de busca.
            // Usamos $match, que é a versão do 'find' para agregações.
            {
                $match: {
                    'origin.point': { $near: { $geometry: { type: "Point", coordinates: from }, $maxDistance: 5000 } },
                    'destination.point': { $near: { $geometry: { type: "Point", coordinates: to }, $maxDistance: 5000 } },
                    status: RideStatus.Scheduled,
                    departureTime: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000) }
                }
            },
            // Estágio 2: Adicionar um novo campo ('remainingSeats') com o cálculo.
            // Esta é a mesma lógica do método estático, agora integrada na busca.
            {
                $addFields: {
                    approvedCount: {
                        $size: {
                            $filter: {
                                input: '$passengers',
                                as: 'passenger',
                                cond: { $eq: ['$$passenger.status', PassengerStatus.Approved] }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    remainingSeats: {
                        $max: [0, { $subtract: ['$availableSeats', '$approvedCount'] }]
                    }
                }
            },
            // Estágio 3: Popular os dados do motorista (equivalente ao .populate()).
            {
                $lookup: {
                    from: 'users', // O nome da coleção de usuários
                    localField: 'driver',
                    foreignField: '_id',
                    as: 'driverInfo'
                }
            },
            // Estágio 4: Formatar a saída para um formato mais limpo.
            {
                $project: {
                    // Inclui todos os campos originais da carona
                    driver: 1,
                    vehicle: 1,
                    origin: 1,
                    destination: 1,
                    departureTime: 1,
                    price: 1,
                    status: 1,
                    // Adiciona o novo campo calculado
                    remainingSeats: 1,
                    // Formata os dados do motorista
                    driverInfo: { $arrayElemAt: ['$driverInfo.name', 0] }
                }
            }
        ];

        const rides = await RideModel.aggregate(pipeline);

        const durationMs = Date.now() - startTime;
        await SearchEventModel.create({
            user: userId,
            durationMs,
            resultsCount: rides.length
        });

        return rides;
    }

    public async getMyRidesAsDriver(driverId: Types.ObjectId): Promise<IRide[]> {
        return RideModel.find({ driver: driverId }).sort({ departureTime: -1 });
    }

    public async getMyRidesAsPassenger(passengerId: Types.ObjectId): Promise<IRide[]> {
        return RideModel.find({ 'passengers.user': passengerId }).populate('driver', 'name');
    }

    public async updateRide(rideId: Types.ObjectId, driverId: Types.ObjectId, updateData: any): Promise<IRide | null> {
        const ride = await RideModel.findById(rideId);
        if (!ride || ride.driver.toString() !== driverId.toString()) throw new Error("Carona não encontrada ou não pertence ao motorista.");
        if (ride.status !== RideStatus.Scheduled) throw new Error("Apenas caronas futuras podem ser editadas.");
        if (ride.passengers.length > 0) throw new Error("Caronas com passageiros não podem ser editadas.");
        if (new Date(ride.departureTime).getTime() - Date.now() < 30 * 60 * 1000) throw new Error("Caronas não podem ser editadas com menos de 30 minutos de antecedência.");

        Object.assign(ride, updateData);
        await ride.save();
        return ride;
    }

    public async requestSeat(rideId: Types.ObjectId, passengerId: Types.ObjectId): Promise<IRide | null> {
        const ride = await RideModel.findById(rideId);
        if (!ride) throw new Error("Carona não encontrada.");
        if (ride.driver.toString() === passengerId.toString()) throw new Error("Você não pode solicitar uma vaga em sua própria carona.");
        if (ride.availableSeats <= 0) throw new Error("Não há assentos disponíveis.");
        if (ride.passengers.some(p => p.user.toString() === passengerId.toString())) throw new Error("Você já solicitou uma vaga nesta carona.");

        ride.passengers.push({ user: passengerId as any, status: PassengerStatus.Pending, requestedAt: new Date() });
        await ride.save();
        return ride;
    }

    public async manageSeatRequest(rideId: Types.ObjectId, driverId: Types.ObjectId, passengerId: Types.ObjectId, action: 'approve' | 'reject'): Promise<IRide | null> {
        const ride = await RideModel.findOne({ _id: rideId, driver: driverId });
        if (!ride) throw new Error("Carona não encontrada ou não pertence ao motorista.");

        const passenger = ride.passengers.find(p => p.user.toString() === passengerId.toString() && p.status === PassengerStatus.Pending);
        if (!passenger) throw new Error("Solicitação de passageiro não encontrada.");

        if (action === 'approve') {
            if (ride.availableSeats <= 0) throw new Error("Não há assentos disponíveis.");
            passenger.status = PassengerStatus.Approved;
            ride.availableSeats -= 1;
        } else {
            passenger.status = PassengerStatus.Rejected;
        }
        passenger.managedAt = new Date();
        await ride.save();
        return ride;
    }

    public async cancelRideByDriver(rideId: Types.ObjectId, driverId: Types.ObjectId): Promise<IRide | null> {
        const ride = await RideModel.findOneAndUpdate(
            { _id: rideId, driver: driverId, status: RideStatus.Scheduled },
            { status: RideStatus.Cancelled },
            { new: true }
        );
        if (!ride) throw new Error("Não foi possível cancelar a carona.");
        return ride;
    }

    public async cancelSeatByPassenger(rideId: Types.ObjectId, passengerId: Types.ObjectId): Promise<IRide | null> {
        const ride = await RideModel.findById(rideId);
        if (!ride) throw new Error("Carona não encontrada.");

        const passenger = ride.passengers.find(p => p.user.toString() === passengerId.toString());
        if (!passenger) throw new Error("Reserva não encontrada.");

        if (passenger.status === PassengerStatus.Approved) {
            ride.availableSeats += 1;
        }
        passenger.status = PassengerStatus.Cancelled;
        passenger.managedAt = new Date();
        await ride.save();
        return ride;
    }

    public async getRideDetails(rideId: Types.ObjectId, userId: Types.ObjectId): Promise<any> {
        const ride = await RideModel.findById(rideId).populate('driver', 'name email').populate('passengers.user', 'name');
        if (!ride) throw new Error("Carona não encontrada.");

        await RideViewEventModel.create({
            kind: 'ride_view',
            user: userId,
            ride: rideId
        });

        const isDriver = ride.driver._id.toString() === userId.toString();
        const passengerInfo = ride.passengers.find(p => p.user._id.toString() === userId.toString() && p.status === PassengerStatus.Approved);

        if (isDriver) {
            const passengers = ride.passengers.filter(p => p.status === PassengerStatus.Approved);
            return { ...ride.toObject(), passengers };
        }

        if (passengerInfo) {
            const { ...rideDetails } = ride.toObject();
            return rideDetails;
        }

        throw new Error("Acesso negado aos detalhes da carona.");
    }
}

export const rideService = new RideService();