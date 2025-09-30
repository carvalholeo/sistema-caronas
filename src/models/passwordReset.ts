import { Schema, model, Model } from "mongoose";
import { IPasswordReset } from "../types";
import { PasswordResetStatus } from "../types/enums/enums";

const PasswordResetSchema = new Schema<IPasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(PasswordResetStatus),
      default: PasswordResetStatus.INITIATED,
    },
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: false },
);

PasswordResetSchema.pre<IPasswordReset>("save", function (next) {
  // For newly COMPLETED requests, set completedAt
  if (
    this.isModified("status") &&
    this.status === PasswordResetStatus.COMPLETED &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }
  return next();
});

function validateCompletedAt(doc: IPasswordReset): Error | undefined {
  if (doc.completedAt) {
    if (doc.status !== PasswordResetStatus.COMPLETED) {
      return new Error(
        `completedAt present but status is ${doc.status.toUpperCase()}`,
      );
    }
    if (doc.completedAt < doc.initiatedAt) {
      return new Error("completedAt cannot be earlier than initiatedAt");
    }
  }
  return undefined;
}

function validateInitialStatus(doc: IPasswordReset): Error | undefined {
  if (doc.isNew && doc.status !== PasswordResetStatus.INITIATED) {
    return new Error(
      `Invalid initial status: ${doc.status}. Must start as INITIATED`,
    );
  }
  return undefined;
}

async function validateStatusTransition(
  doc: IPasswordReset,
): Promise<Error | undefined> {
  if (!doc.isNew && doc.isModified("status")) {
    let fromStatus: PasswordResetStatus | undefined;
    try {
      const prev = await (doc.constructor as Model<IPasswordReset>).findById(
        doc._id,
      );
      fromStatus = prev ? prev.status : undefined;
    } catch {
      return new Error("Previous status not found");
    }
    if (!fromStatus) {
      return new Error("Previous status not found");
    }
    const allowed = allowedTransitions[fromStatus] || [];
    if (!allowed.includes(doc.status)) {
      return new Error(`Invalid transition: ${fromStatus} -> ${doc.status}`);
    }
  }
  return undefined;
}

PasswordResetSchema.pre<IPasswordReset>("save", async function (next) {
  if (!this.initiatedAt) {
    this.initiatedAt = new Date();
  }

  const completedAtError = validateCompletedAt(this);
  if (completedAtError) return next(completedAtError);

  const initialStatusError = validateInitialStatus(this);
  if (initialStatusError) return next(initialStatusError);

  const transitionError = await validateStatusTransition(this);
  if (transitionError) return next(transitionError);

  if (
    this.isModified("status") &&
    this.status === PasswordResetStatus.COMPLETED &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }
  return next();
});

const allowedTransitions: Record<PasswordResetStatus, PasswordResetStatus[]> = {
  [PasswordResetStatus.INITIATED]: [
    PasswordResetStatus.CANCELLED,
    PasswordResetStatus.EXPIRED,
    PasswordResetStatus.VERIFIED,
  ],
  [PasswordResetStatus.VERIFIED]: [
    PasswordResetStatus.COMPLETED,
    PasswordResetStatus.EXPIRED,
  ],
  [PasswordResetStatus.COMPLETED]: [],
  [PasswordResetStatus.CANCELLED]: [],
  [PasswordResetStatus.EXPIRED]: [],
};

export const PasswordResetModel = model<IPasswordReset>(
  "PasswordReset",
  PasswordResetSchema,
);
