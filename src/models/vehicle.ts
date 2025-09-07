import { Schema, model } from 'mongoose';
import { IVehicle } from 'types';
import { RideStatus, VehicleStatus } from 'types/enums/enums';

const VehicleSchema = new Schema<IVehicle>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  plate: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [
      /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/,
      'Please enter a valid license plate format (ABC1234 or ABC1A23)'
    ]
  },
  make: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  carModel: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  year: {
    type: Number,
    required: true,
    min: 1900,
    validate: {
      validator: function (y: number) {
        const max = new Date().getFullYear() + 1;
        return y <= max;
      },
      message: 'Year must not be in the far future',
    },
  },
  color: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  capacity: {
    type: Number,
    required: true,
    min: 2,
    max: 8
  },
  photoUrl: { type: String },
  status: { type: String, enum: Object.values(VehicleStatus), default: VehicleStatus.Active },
}, { timestamps: true });

VehicleSchema.index({ owner: 1 });

VehicleSchema.index(
  { plate: 1 },
  { unique: true, partialFilterExpression: { status: VehicleStatus.Active } }
);

async function hasActiveRides(vehicleId: Schema.Types.ObjectId): Promise<boolean> {
  const Ride = model('Ride');
  const count = await Ride.countDocuments({
    vehicle: vehicleId,
    status: { $in: [RideStatus.InProgress, RideStatus.Scheduled] },
  }).lean();
  return count > 0;
}

VehicleSchema.pre<IVehicle>('validate', async function (next) {
  const doc = this;
  if (!doc.isNew && doc.isModified('owner') && doc.status === VehicleStatus.Active) {
    return next(new Error('Owner cannot be changed while vehicle is active'));
  }
  if (!doc.plate) return next();
  const plateChanged = doc.isNew || doc.isModified('plate') || doc.isModified('status');

  if (plateChanged) {
    const existingActive = await VehicleModel.findOne({
      _id: { $ne: doc._id },
      plate: doc.plate,
      status: VehicleStatus.Active,
    })
      .select({ _id: 1 })
      .lean();

    if (existingActive) {
      // Se já há ativo com a mesma placa → este deve ficar Pending
      doc.status = VehicleStatus.Pending;
    } else {
      // Se não há ativo com a mesma placa → pode ficar Active (se não foi explicitamente setado para outro)
      if (!doc.status || [VehicleStatus.Pending, VehicleStatus.Inactive, VehicleStatus.Rejected].includes(doc.status)) {
        doc.status = VehicleStatus.Active;
      }
    }
  }
  return next();
});

VehicleSchema.pre<IVehicle>('save', async function (next) {
  const doc = this;

  if (!doc.isNew && !doc.isModified('plate')) {
    return next();
  }

  const changingCritical =
    doc.isModified('status') ||
    doc.isModified('plate') ||
    doc.isModified('capacity');

  if (changingCritical) {
    const activeRides = await hasActiveRides(doc._id as Schema.Types.ObjectId);
    if (activeRides) {
      // permitir apenas alterações não críticas quando há rides ativas
      // bloquear: desativar (status para Inactive/Rejected/Pending), trocar plate, alterar capacity
      const statusChange = doc.isModified('status') && doc.status !== VehicleStatus.Active;
      const plateChange = doc.isModified('plate');
      const capacityChange = doc.isModified('capacity');

      if (statusChange || plateChange || capacityChange) {
        return next(new Error('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides'));
      }
    }
  }

  next();
});

export const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
