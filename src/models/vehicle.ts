import { Schema, model } from 'mongoose';
import { IVehicle } from 'types';
import { VehicleStatus } from 'types/enums/enums';


// Subdocumento de auditoria
const AuditLogSchema = new Schema({
  action: { type: String, required: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  reason: { type: String },
});

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
    max: new Date().getFullYear() + 1
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
  auditHistory: [AuditLogSchema],
}, { timestamps: true });

VehicleSchema.index({ owner: 1 });

VehicleSchema.pre<IVehicle>('save', function(next) {
  this.updatedAt = new Date();
  next();
});

VehicleSchema.pre<IVehicle>('save', async function(next) {
  if (!this.isNew && !this.isModified('plate')) {
    return next();
  }


  const existingVehicle = await this.collection.findOne({
    licensePlate: this.plate,
    $ne: { _id: this._id },
    status: VehicleStatus.Active
  });

  if (existingVehicle) {
    // If there's already an active vehicle with this plate,
    // set this one to pending approval
    this.status = VehicleStatus.Pending;
  }

  next();
});

export const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
