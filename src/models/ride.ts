import { Schema, model } from 'mongoose';
import { IRide, IUser, ILocation, IRidePassenger } from 'types';
import { PassengerStatus, RideStatus, VehicleStatus } from 'types/enums/enums';
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
  canceledAt: { type: Date },
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
PassengerSchema.pre<IRidePassenger>('validate', function (next) {
  if (this.isNew) {
    if (this.status !== PassengerStatus.Pending) {
      return next(new Error('Invalid initial status. New passengers must start with status "pending"'));
    }
  }

  if (this.isModified('status')) {
    const terminalStatuses = [PassengerStatus.Approved, PassengerStatus.Rejected, PassengerStatus.Cancelled];
    if (terminalStatuses.includes(this.status as PassengerStatus)) {
      this.updatedAt = new Date();
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
  // --- VALIDAÇÕES GERAIS ---
  // Mínimo de 2h de antecedência em updates
  if (!this.isNew && this.isModified('departureTime')) {
    if (this.departureTime.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
      return next(new Error('Updated departure time must be at least 2 hours in the future'));
    }
  }

  // --- VALIDAÇÃO DE TRANSIÇÃO DE STATUS DA CARONA ---
  if (this.isModified('status')) {
    const prev = await RideModel.findById(this._id).lean();

    if (this.isNew) {
      if (this.status !== RideStatus.Scheduled) {
        return next(new Error(`Invalid initial status: ${this.status}. Must start as "scheduled"`));
      }
    } else if (prev && prev.status !== this.status) {
      const status = prev.status as RideStatus;
      const allowed = allowedTransitionsRide[status] || [];

      if (allowed.length === 0 || !allowed.includes(this.status)) {
        return next(new Error(`Invalid status transition: ${status} -> ${this.status}`));
      }
    }
  }

  // --- VALIDAÇÃO DE TRANSIÇÃO DE STATUS DE PASSAGEIROS ---
  if (!this.isNew && this.isModified('passengers')) {
    const originalDoc = await RideModel.findById(this._id).lean();
    if (originalDoc) {
      this.passengers.forEach(currentPassenger => {
        const originalPassenger = originalDoc.passengers.find(p => p.user.equals(currentPassenger.user));
        if (originalPassenger && originalPassenger.status !== currentPassenger.status) {
          const prevStatus = originalPassenger.status as PassengerStatus;
          const nextStatus = currentPassenger.status as PassengerStatus;
          const allowed = allowedTransitionsPassengers[prevStatus] || [];
          if (!allowed.includes(nextStatus)) {
            return next(new Error(`Invalid passenger status transition: ${prevStatus} -> ${nextStatus}`));
          }
        }
      });
    }
  }

  // --- REGRAS DE ASSENTOS ---
  const approvedCount = this.passengers.filter(p => p.status === PassengerStatus.Approved).length;
  if (approvedCount > this.availableSeats) {
    return next(new Error(`Approved passengers (${approvedCount}) exceed available seats (${this.availableSeats})`));
  }

  // --- LÓGICA DE BLOQUEIO DE EDIÇÃO (CORRIGIDA) ---
  const modifiedPaths = this.modifiedPaths();
  // Permite apenas a modificação do array de passageiros ou do status para cancelado


  const isOnlyPassengerOrCancelChange = modifiedPaths.every(path =>
    path.startsWith('passengers') || path === 'status' || path === 'updatedAt'
  );

  if (!this.isNew && !isOnlyPassengerOrCancelChange) {
    const hasBlockingPassengers = this.passengers.some(p => [PassengerStatus.Pending, PassengerStatus.Approved].includes(p.status));
    const isWithinOneHour = this.departureTime.getTime() - Date.now() <= 60 * 60 * 1000;

    if (hasBlockingPassengers) {
      return next(new Error('Ride cannot be edited while there are pending or approved passengers'));
    }
    if (isWithinOneHour) {
      return next(new Error('Ride cannot be edited within 1 hour before departureTime'));
    }
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
    const prev: RideStatus | undefined = this.get('status', null, { previous: true });
    if (prev === RideStatus.Scheduled && Array.isArray(this.passengers)) {
      if (this.status === RideStatus.Cancelled) {
        for (const p of this.passengers) {
          if ([PassengerStatus.Pending].includes(p.status)) {
            p.id(p._id).set('status', PassengerStatus.Cancelled);
          }
        }
        this.markModified('passengers');
      }

      if (this.status === RideStatus.InProgress) {
        for (const p of this.passengers) {
          if (p.status === PassengerStatus.Pending) {
            p.id(p._id).set('status', PassengerStatus.Rejected);
          }
        }
        this.markModified('passengers');
      }

      if (this.status === RideStatus.Cancelled) {
        if (!this.cancelReason) {
          return next(new Error('Cancel reason is required when cancelling a ride'));
        }
        if (!this.canceledAt) {
          this.canceledAt = new Date();
        }
      } else {
        // Se o status está mudando para qualquer outra coisa, limpa os dados de cancelamento.
        this.canceledAt = undefined;
        this.cancelReason = undefined;
      }
    }
    // Garantir que readaptações de passageiros aprovados comecem com Scheduled/InProgress
    // e InProgress só se houver driver definido (already required)
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
