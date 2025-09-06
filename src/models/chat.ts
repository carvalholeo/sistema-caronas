import { Schema, Types, model } from 'mongoose';
import { IChatMessage, IRide } from 'types';
import { MessageStatus } from 'types/enums/enums';

const ChatMessageSchema = new Schema<IChatMessage>({
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
    validate: {
      validator: function (content: string) {
        // Unicode property escapes precisam da flag 'u'; Mongoose aceita string/RegExp,
        // mas aqui usamos RegExp literal com 'u'
        // Permite letras, números, pontuação, espaços/separadores; proíbe controle não-impressos
        const re = /^[\p{L}\p{N}\p{P}\p{Z}\s]*$/u;
        return re.test(content);
      },
      message: 'Message content contains invalid characters',
    },
  },
  status: { type: String, enum: Object.values(MessageStatus), default: MessageStatus.Sent, index: true },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  isModerated: { type: Boolean, default: false },
  moderationDetails: {
    originalContent: { type: String },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    reason: { type: String },
  },
}, { timestamps: true });

ChatMessageSchema.index({ ride: 1, createdAt: 1 });
ChatMessageSchema.index({ ride: 1, sender: 1, createdAt: 1 });

// Validação condicional: moderationDetails requer campos quando isModerated = true
ChatMessageSchema.pre<IChatMessage>('validate', function (next) {
  const doc = this;
  if (doc.isModerated) {
    const md = doc.moderationDetails;
    // moderatedBy e moderatedAt passam a ser obrigatórios quando moderado
    if (!md?.moderatedBy) {
      return next(new Error('moderationDetails.moderatedBy is required when isModerated is true'));
    }
    if (!md?.moderatedAt) {
      return next(new Error('moderationDetails.moderatedAt is required when isModerated is true'));
    }
    if (!md?.originalContent) {
      return next(new Error('moderationDetails.originalContent is required when isModerated is true'));
    }
  }
  // coerência temporal básica
  if (doc.readAt && doc.deliveredAt && doc.readAt < doc.deliveredAt) {
    return next(new Error('readAt cannot be earlier than deliveredAt'));
  }
  return next();
});

// Máquina de estados para MessageStatus
const allowedTransitions: Record<MessageStatus, MessageStatus[]> = {
  [MessageStatus.Sent]: [MessageStatus.Received, MessageStatus.Read], // alguns sistemas marcam read sem received explícito
  [MessageStatus.Received]: [MessageStatus.Read],
  [MessageStatus.Read]: [], // terminal
};

ChatMessageSchema.pre<IChatMessage>('validate', function (next) {
  const doc = this;
  if (!doc.isModified('status')) return next();

  // valor anterior do status
  const prevStatus: MessageStatus | undefined = doc.get('status', null, { previous: true });
  if (!prevStatus) return next(); // novo doc, default é Sent

  if (prevStatus !== doc.status) {
    const allowed = allowedTransitions[prevStatus] || [];
    if (!allowed.includes(doc.status)) {
      return next(new Error(`Invalid status transition: ${prevStatus} -> ${doc.status}`));
    }
  }
  return next();
});

ChatMessageSchema.pre<IChatMessage>('save', async function (next) {
  if (this.isNew) {
    const Ride = model<IRide>('Ride');
    const ride = await Ride.findById(this.ride).select({ driver: 1, passengers: 1 });

    if (!ride) {
      return next(new Error('Ride not found'));
    }

    const senderStr = this.sender.toString();
    const isDriver = ride.driver?.toString?.() === senderStr;

    const isPassenger = Array.isArray(ride.passengers) && ride.passengers.some((p: any) => {
      const id = (p && (p._id || p)) as Types.ObjectId;
      return id.toString() === senderStr;
    });

    if (!isDriver && !isPassenger) {
      return next(new Error('Users must be part of the ride to chat'));
    }

    // Set deliveredAt/readAt conforme status
    if (this.isModified('status')) {
      switch (this.status as MessageStatus) {
        case MessageStatus.Received:
          if (!this.deliveredAt) this.deliveredAt = new Date();
          break;
        case MessageStatus.Read:
          if (!this.deliveredAt) this.deliveredAt = new Date(); // garantir ordem
          if (!this.readAt) this.readAt = new Date();
          break;
        default:
          break;
      }
    }
  }

  // Garantir coerência: readAt >= deliveredAt quando ambos existir
  if (this.readAt && this.deliveredAt && this.readAt < this.deliveredAt) {
    return next(new Error('readAt cannot be earlier than deliveredAt'));
  }

  return next();
});

export const ChatMessageModel = model<IChatMessage>('ChatMessage', ChatMessageSchema);
