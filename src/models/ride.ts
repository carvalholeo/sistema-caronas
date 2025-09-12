import { Schema, model } from 'mongoose';
import { IRide, Location, RidePassenger } from 'types';
import { PassengerStatus, RideStatus, VehicleStatus } from 'types/enums/enums';

const PointSchema = new Schema<Location>({
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

const PassengerSchema = new Schema<RidePassenger>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(PassengerStatus), default: PassengerStatus.Pending },
  requestedAt: { type: Date, default: Date.now },
  managedAt: { type: Date },
});

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
  availableSeats: { type: Number, required: true, min: 0, max: 7 },
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
PassengerSchema.pre<RidePassenger>('validate', function (next) {
  // requestedAt imutável após criação
  if (!this.isNew && this.isModified('requestedAt')) {
    return next(new Error('requestedAt cannot be modified after creation'));
  }

  if (this.isModified('status')) {
    const prev: PassengerStatus | undefined = this.get('status', null, { previous: true });

    if (this.isNew) {
      if (this.status !== PassengerStatus.Pending) {
        return next(new Error(`Invalid initial status: ${this.status}. Must start as "pending"`));
      }
      return next();
    }

    if (prev && prev !== this.status) {
      const allowed = allowedTransitionsPassengers[prev] || [];
      if (!allowed.includes(this.status)) {
        return next(new Error(`Invalid status transition: ${prev} -> ${this.status}`));
      }
    }
  }

  // coerência temporal: se já houver managedAt, deve ser >= requestedAt
  if (this.managedAt && this.requestedAt && this.managedAt < this.requestedAt) {
    return next(new Error('managedAt cannot be earlier than requestedAt'));
  }

  return next();
});

PassengerSchema.pre<RidePassenger>('save', function (next) {
  if (this.isModified('status')) {
    switch (this.status as PassengerStatus) {
      case PassengerStatus.Approved:
      case PassengerStatus.Rejected:
      case PassengerStatus.Cancelled:
        if (!this.managedAt) this.managedAt = new Date();
        if (this.requestedAt && this.managedAt < this.requestedAt) {
          return next(new Error('managedAt cannot be earlier than requestedAt'));
        }
        break;
      case PassengerStatus.Pending:
        // transições de volta não são permitidas segundo allowedTransitions
        break;
      default:
        break;
    }
  }

  return next();
});

RideSchema.pre<IRide>('validate', function (next) {
  // departureTime mínimo 2h à frente também em updates
  if (!this.isNew && this.isModified('departureTime')) {
    if (this.departureTime.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
      return next(new Error('Updated departure time must be at least 2 hours in the future'));
    }
  }

  // Edição bloqueada com passageiros pendentes/aceitos
  const hasBlockingPassengers =
    Array.isArray(this.passengers) &&
    this.passengers.some((p) => p.status === PassengerStatus.Pending || p.status === PassengerStatus.Approved);

  // Edição bloqueada até 1h antes (qualquer alteração estrutural)
  const isWithinOneHour = this.departureTime.getTime() - Date.now() <= 60 * 60 * 1000;

  // Quais paths não podem ser editados nessas condições?
  // Bloquear se QUALQUER modificação ocorrer quando deveria estar bloqueado
  if (!this.isNew && (hasBlockingPassengers || isWithinOneHour)) {
    // Se apenas status está mudando para Cancelled, pode-se permitir dependendo da política; aqui, bloqueamos edições gerais.
    // Verifique se há qualquer modificação
    const modifiedPaths = this.modifiedPaths();
    // Permitir apenas status -> Cancelled dentro da janela e com bloqueio de passageiros
    const onlyCancel =
      modifiedPaths.length === 1 &&
      modifiedPaths.includes('status') &&
      this.get('status') === RideStatus.Cancelled;

    if (!onlyCancel) {
      if (hasBlockingPassengers) {
        return next(new Error('Ride cannot be edited while there are pending or approved passengers'));
      }
      if (isWithinOneHour) {
        return next(new Error('Ride cannot be edited within 1 hour before departureTime'));
      }
    }
  }

  // validar transição de status
  if (this.isModified('status')) {
    const prev: RideStatus | undefined = this.get('status', null, { previous: true });

    if (this.isNew) {
      if (this.status !== RideStatus.Scheduled) {
        return next(new Error(`Invalid initial status: ${this.status}. Must start as "scheduled"`));
      }
    } else if (prev && prev !== this.status) {
      const allowed = allowedTransitionsRide[prev] || [];
      if (!allowed.includes(this.status)) {
        return next(new Error(`Invalid status transition: ${prev} -> ${this.status}`));
      }
    }
  }

  // regra de assentos: número de aprovados não pode exceder availableSeats
  const approvedCount = Array.isArray(this.passengers)
    ? this.passengers.filter((p) => p.status === PassengerStatus.Approved).length
    : 0;
  if (approvedCount > this.availableSeats) {
    return next(new Error(`Approved passengers (${approvedCount}) exceed available seats (${this.availableSeats})`));
  }

  // impedir availableSeats negativo ou reduzir abaixo dos aprovados
  if (this.isModified('availableSeats')) {
    if (this.availableSeats < 0) {
      return next(new Error('availableSeats cannot be negative'));
    }
    if (approvedCount > this.availableSeats) {
      return next(
        new Error(`Cannot reduce availableSeats below current approved passengers (${approvedCount})`)
      );
    }
  }

  // coerência temporal: canceledAt não pode ser antes de createdAt / nem antes de departureTime para certos fluxos
  if (this.canceledAt && this.departureTime && this.canceledAt.getTime() < this.createdAt.getTime()) {
    return next(new Error('canceledAt cannot be earlier than createdAt'));
  }

  return next();
});

RideSchema.pre<IRide>('save', async function (next) {
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
    const criteria = {
      _id: {},
      driver: this.driver,
      departureTime: { $gte: start, $lte: end },
    };
    if (!this.isNew) {
      criteria._id = { $ne: this._id };
    }
    const count = await RideModel.countDocuments(criteria);
    if (count >= 4) {
      return next(new Error('A driver cannot have more than 4 rides on the same day'));
    }
  }

  if (this.isNew || this.isModified('vehicle')) {
    const Vehicle = model('Vehicle');
    const vehicle = await Vehicle.findById(this.vehicle).select({ status: 1, owner: 1 });

    if (!vehicle) {
      return next(new Error('Vehicle not found'));
    }

    if (vehicle.status !== VehicleStatus.Active) {
      return next(new Error('Vehicle must be active and approved to create rides'));
    }

    if (vehicle.owner?.toString?.() !== this.driver.toString()) {
      return next(new Error('Driver must own the vehicle'));
    }
  }

  if (this.isModified('status')) {
    const prev: RideStatus | undefined = this.get('status', null, { previous: true });
    if (prev === RideStatus.Scheduled && this.status !== RideStatus.Scheduled) {
      if (Array.isArray(this.passengers)) {
        for (const p of this.passengers) {
          if ([PassengerStatus.Pending, PassengerStatus.Approved].includes(p.status)) {
            p.status = PassengerStatus.Cancelled;
          }
        }
      }
    }
  }

  if (this.isModified('status')) {
    if (this.status === RideStatus.Cancelled) {
      if (!this.canceledAt) this.canceledAt = new Date();
      if (!this.cancelReason) {
        return next(new Error('Cancel reason is required when cancelling a ride'));
      }
    }
    this.canceledAt = undefined;
  }

  // Garantir que readaptações de passageiros aprovados comecem com Scheduled/InProgress
  // e InProgress só se houver driver definido (already required)

  return next();
});


const allowedTransitionsPassengers: Record<PassengerStatus, PassengerStatus[]> = {
  [PassengerStatus.Pending]: [PassengerStatus.Approved, PassengerStatus.Rejected, PassengerStatus.Cancelled],
  [PassengerStatus.Approved]: [],
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
