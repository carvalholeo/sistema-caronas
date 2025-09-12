import { Schema, model, Document } from 'mongoose';

export interface IIdempotencyRequest extends Document {
  key: Schema.Types.UUID;
  status: 'processing' | 'completed';
  responseStatusCode?: number;
  responseBody?: object;
  expiresAt: Date;
}

const IdempotencyRequestSchema = new Schema<IIdempotencyRequest>({
  key: { type: Schema.Types.UUID, required: true, unique: true },
  status: { type: String, enum: ['processing', 'completed'], required: true },
  responseStatusCode: { type: Number },
  responseBody: { type: Schema.Types.Mixed },
  // Chaves expiram em 24h para manter a coleção limpa
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const IdempotencyRequestModel = model<IIdempotencyRequest>('IdempotencyRequest', IdempotencyRequestSchema);
