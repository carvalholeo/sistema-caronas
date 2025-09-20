import { Schema, model } from 'mongoose';
import { IVehicle } from '../types';
import { RideStatus, VehicleStatus } from '../types/enums/enums';
import { RideModel } from './ride';

const VehicleSchema = new Schema<IVehicle>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plate: {
    type: String,
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

VehicleSchema.index(
  { plate: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: VehicleStatus.Active } }
);

async function hasActiveRides(vehicleId: IVehicle): Promise<boolean> {
  const existingActiveRide = await RideModel.findOne({
    vehicle: vehicleId._id,
    status: { $in: [RideStatus.InProgress, RideStatus.Scheduled] },
  }).select({ _id: 1 });
  return existingActiveRide !== null;
}

VehicleSchema.pre<IVehicle>('validate', async function (next) {
  if (!this.isNew && this.isModified('owner') && this.status === VehicleStatus.Active) {
    return next(new Error('Owner cannot be changed while vehicle is active'));
  }

  const changingCritical =
    this.isModified('status') ||
    this.isModified('plate') ||
    this.isModified('capacity');
    const activeRides = await hasActiveRides(this);

  if (changingCritical && activeRides) {
    return next(new Error('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides'));
  }

  if (!this.plate) return next();

  const plateStatusChanged = !this.isNew && (this.isModified('plate') || this.isModified('status'));

  if (plateStatusChanged || this.isNew) {
    const existingActive = await VehicleModel.findOne({
      _id: { $ne: this._id },
      plate: this.plate,
      status: VehicleStatus.Active,
    })
      .select({ _id: 1 })
      .lean();

    if (existingActive) {
      // Se já há ativo com a mesma placa → este deve ficar Pending
      this.status = VehicleStatus.Pending;
    }
  }
  return next();
});

export const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
