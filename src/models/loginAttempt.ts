import { Schema, model } from 'mongoose';
import { ILoginAttempt } from 'types';
import { ipValidator } from 'utils/ipValidator';

const LoginAttemptSchema = new Schema<ILoginAttempt>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true },
  ipAddress: {
    type: String,
    required: false,
    index: true,
    validate: {
      validator: ipValidator,
      message: 'Invalid IP address format'
    }
  },
  device: { type: String, required: true },
  wasSuccessful: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const LoginAttemptModel = model<ILoginAttempt>('LoginAttempt', LoginAttemptSchema);
