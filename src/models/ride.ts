import { Schema, model } from 'mongoose';
import { IRide, IUser, ILocation, IRidePassenger } from '../types';
import { PassengerStatus, RideStatus, VehicleStatus } from '../types/enums/enums';
import { VehicleModel } from './vehicle';

const PointSchema = new Schema<ILocation>({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function (coords: number[]) {
        return coords.length === 2 &&
          coords[0] >= -180 && coords[0] <= 180 && // longitude
          coords[1] >= -90 && coords[1] <= 90;     // latitude
      },
      message: 'Coordinates must be [longitude, latitude] with valid ranges'
    }
  },
  address: { type: String },
}, { _id: false });

const PassengerSchema = new Schema<IRidePassenger>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(PassengerStatus), default: PassengerStatus.Pending }
}, { timestamps: true });

const RideSchema = new Schema<IRide>({
  driver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  origin: { location: { type: String }, point: { type: PointSchema, required: true } },
  destination: { location: { type: String }, point: { type: PointSchema, required: true } },
  intermediateStops: [{ location: { type: String }, point: { type: PointSchema } }],
  departureTime: {
    type: Date, required: true, validate: {
      validator: function (date: Date) {
        return date.getTime() >= Date.now() + 2 * 60 * 60 * 1000;
      },
      message: 'Departure time must be at least 2 hours in the future'
    }
  },
  availableSeats: { type: Number, required: true, min: 1, max: 7 },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: Object.values(RideStatus), default: RideStatus.Scheduled, index: true },
  passengers: { type: [PassengerSchema], index: true, default: [] },
  isRecurrent: { type: Boolean, default: false },
  recurrenceId: { type: String, index: true },
  distanceKm: { type: Number },
  cancelReason: { type: String }
}, { timestamps: true });

RideSchema.index({ 'origin.point': '2dsphere', 'destination.point': '2dsphere', departureTime: 1 });
RideSchema.index({ 'passengers.user': 1 });

RideSchema.methods.canBeCancelled = function (): boolean {
  const now = new Date();
  const departureTime = new Date(this.departureTime);
  const timeDifference = departureTime.getTime() - now.getTime();
  const hoursUntilDeparture = timeDifference / (1000 * 60 * 60);

  return hoursUntilDeparture >= 1 && this.status !== RideStatus.Cancelled;
};

//Ride Passenger
PassengerSchema.pre<IRidePassenger>('validate', async function (next) {
  const ride = this.$parent() as IRide;

  if (this.isNew) {
    if (this.status !== PassengerStatus.Pending) {
      return next(new Error('Invalid initial status. New passengers must start with status "pending"'));
    }
  } else if (this.isModified('status')) {
    // Para validar a transição, precisamos buscar o estado anterior do documento no banco

    const originalRide = await RideModel.findById(ride._id).lean();
    if (originalRide) {
      const originalPassenger = originalRide.passengers.find(p => p.user.equals(this.user));

      if (originalPassenger) {
        const prevStatus = originalPassenger.status as PassengerStatus;
        const nextStatus = this.status as PassengerStatus;
        const allowed = allowedTransitionsPassengers[prevStatus] || [];

        if (!allowed.includes(nextStatus)) {
          return next(new Error(`Invalid passenger status transition: ${prevStatus} -> ${nextStatus}`));
        }
      }
    }
  }
  next();
});

PassengerSchema.pre<IRidePassenger>('save', function (next) {
  if (this.isModified('status')) {
    switch (this.status as PassengerStatus) {
      case PassengerStatus.Approved:
      case PassengerStatus.Rejected:
      case PassengerStatus.Cancelled:
        this.updatedAt = new Date();
        break;
      case PassengerStatus.Pending:
        break;
      default:
        break;
    }
  }

  return next();
});


RideSchema.pre<IRide>('validate', async function (next) {
  // --- SEÇÃO 1: VALIDAÇÕES UNIVERSAIS E INCONDICIONAIS ---
  const approvedCount = this.passengers.filter(p => p.status === PassengerStatus.Approved).length;
  if (approvedCount > this.availableSeats) {
    return next(new Error(`Approved passengers (${approvedCount}) exceed available seats (${this.availableSeats})`));
  }
  // Regra 1: Transição de Status da Carona (DEVE SER A PRIMEIRA)
  if (this.isModified('status')) {
    if (this.isNew) {
      if (this.status !== RideStatus.Scheduled) {
        return next(new Error(`Invalid initial status: ${this.status}. Must start as "scheduled"`));
      }
    } else {
      const originalDoc = await RideModel.findById(this._id).select('status').lean();
      if (originalDoc && originalDoc.status !== this.status) {
        const prevStatus = originalDoc.status as RideStatus;
        const allowed = allowedTransitionsRide[prevStatus] || [];
        if (!allowed.includes(this.status as RideStatus)) {
          return next(new Error(`Invalid status transition: ${prevStatus} -> ${this.status}`));
        }
      } else {
        return next();
      }
    }
  }

  // --- VALIDAÇÃO DE EDIÇÕES PROIBIDAS (QUANDO HÁ PASSAGEIROS OU PERTO DA PARTIDA) ---
  if (!this.isNew) {
    const hasBlockingPassengers = this.passengers.some(p => [PassengerStatus.Pending, PassengerStatus.Approved].includes(p.status));
    const isWithinOneHour = this.departureTime.getTime() - Date.now() <= 60 * 60 * 1000;

    if (hasBlockingPassengers || isWithinOneHour) {
      const forbiddenPaths = ['origin', 'destination', 'departureTime', 'availableSeats', 'price', 'isRecurrent'];
      const modifiedPaths = this.modifiedPaths();
      
      const hasForbiddenChanges = modifiedPaths.some(path => forbiddenPaths.includes(path));

      if (hasForbiddenChanges) {
        const reason = hasBlockingPassengers ? 'while there are pending or approved passengers' : 'within 1 hour before departureTime';
        return next(new Error(`Ride cannot be edited ${reason}`));
      }
    }
  }

  // --- OUTRAS VALIDAÇÕES DE CONSISTÊNCIA ---
  if (this.status === RideStatus.Cancelled && !this.cancelReason) {
    return next(new Error('Cancel reason is required when cancelling a ride'));
  }

  return next();
});

RideSchema.pre<IRide>('save', async function (next) {
  if (this.isModified('vehicle')) {
    const vehicle = await VehicleModel.findById(this.vehicle).select({ status: 1, owner: 1 });

    if (!vehicle) {
      return next(new Error('Vehicle not found'));
    }

    if (vehicle.status !== VehicleStatus.Active) {
      return next(new Error('Vehicle must be active and approved to create rides'));
    }

    if (vehicle.owner.toString() !== (this.driver._id as unknown as Schema.Types.ObjectId).toString()) {
      return next(new Error('Driver must own the vehicle'));
    }
  }

  if (this.isNew) {
    const oneHour = 60 * 60 * 1000; // 1 hora em milissegundos
    const newDepartureTime = this.departureTime.getTime();

    // Define a janela de tempo de verificação: 1h antes e 1h depois.
    const lowerBound = new Date(newDepartureTime - oneHour);
    const upperBound = new Date(newDepartureTime + oneHour);

    // Procura por caronas conflitantes no banco de dados.
    const conflictingRide = await RideModel.findOne({
      driver: this.driver,
      // Apenas caronas agendadas ou em andamento podem conflitar.
      status: { $in: [RideStatus.Scheduled, RideStatus.InProgress, RideStatus.Completed] },
      // Verifica se a partida de alguma carona existente está dentro da janela.
      departureTime: {
        $gte: lowerBound,
        $lte: upperBound,
      },
    });

    // Se uma carona conflitante for encontrada, bloqueia a criação.
    if (conflictingRide) {
      return next(new Error('Driver already has a scheduled ride within one hour of this departure time.'));
    }
  }

  // No máximo 4 corridas no mesmo dia (por driver)
  // Considera o dia do departureTime
  if (this.driver && this.departureTime) {
    const { start, end } = dayBounds(this.departureTime);
    interface ICriteria {
      _id?: {
        $ne: unknown;
      };
      driver: IUser;
      departureTime: {
        $gte: Date;
        $lte: Date;
      };
    }

    const criteria: ICriteria = {
      driver: this.driver,
      departureTime: { $gte: start, $lte: end }
    };

    if (!this.isNew) {
      criteria._id = { $ne: this._id };
    }
    const count = await RideModel.countDocuments(criteria);
    if (count >= 4) {
      return next(new Error('A driver cannot have more than 4 rides on the same day'));
    }
  }

  if (this.isModified('status')) {
    const originalDoc = await RideModel.findById(this._id).lean(); // Busca o estado anterior

    // Apenas aplica a regra se a transição for de 'Scheduled'
    if (originalDoc && originalDoc.status === RideStatus.Scheduled) {
      // Se a carona está começando, rejeita os passageiros pendentes
      if (this.status === RideStatus.InProgress) {
        let modified = false;
        this.passengers.forEach(p => {
          if (p.status === PassengerStatus.Pending) {
            p.status = PassengerStatus.Rejected;
            modified = true;
          }
        });
        if (modified) this.markModified('passengers');
      }
    }
  }

  // Lógica para definir/limpar campos de cancelamento
  if (this.status !== RideStatus.Cancelled) {
    this.cancelReason = undefined;
  }

  return next();
});

const allowedTransitionsPassengers: Record<PassengerStatus, PassengerStatus[]> = {
  [PassengerStatus.Pending]: [PassengerStatus.Approved, PassengerStatus.Rejected, PassengerStatus.Cancelled],
  [PassengerStatus.Approved]: [PassengerStatus.Cancelled],
  [PassengerStatus.Rejected]: [],
  [PassengerStatus.Cancelled]: [],
};

const allowedTransitionsRide: Record<RideStatus, RideStatus[]> = {
  [RideStatus.Scheduled]: [RideStatus.InProgress, RideStatus.Cancelled],
  [RideStatus.InProgress]: [RideStatus.Completed, RideStatus.Cancelled],
  [RideStatus.Completed]: [],
  [RideStatus.Cancelled]: [],
};

function dayBounds(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

export const RideModel = model<IRide>('Ride', RideSchema);
