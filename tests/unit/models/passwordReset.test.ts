// test/password-reset.test.ts

import mongoose from 'mongoose';
import { PasswordResetModel } from '../../../src/models/passwordReset';
import { PasswordResetStatuses } from '../../../src/types/enums/enums';

describe('PasswordReset state machine', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/pr-state-test', { dbName: 'pr-state-test' } as any);
    await PasswordResetModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('cria apenas em INITIATED', async () => {
    const ok = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    expect(ok.status).toBe(PasswordResetStatuses.INITIATED);

    await expect(
      PasswordResetModel.create({ user: new mongoose.Types.ObjectId(), status: PasswordResetStatuses.COMPLETED })
    ).rejects.toThrow(/Invalid initial status/i);
  });

  it('permite transições válidas e bloqueia inválidas', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatuses.INITIATED;
    await expect(doc.save()).resolves.toBeDefined();

    doc.status = PasswordResetStatuses.VERIFIED;
    await expect(doc.save()).resolves.toBeDefined();

    // inválida: voltar para CODE_SENT
    doc.status = PasswordResetStatuses.INITIATED;
    await expect(doc.save()).rejects.toThrow(/Invalid transition/i);
  });

  it('ao completar, define completedAt e valida coerência temporal', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatuses.INITIATED;
    await doc.save();
    doc.status = PasswordResetStatuses.VERIFIED;
    await doc.save();
    doc.status = PasswordResetStatuses.COMPLETED;
    await doc.save();
    expect(doc.completedAt).toBeInstanceOf(Date);
    expect(doc.completedAt!.getTime()).toBeGreaterThanOrEqual(doc.initiatedAt.getTime());

    // não permite completedAt se status não for COMPLETED
    doc.completedAt = new Date();
    doc.status = PasswordResetStatuses.EXPIRED;
    await expect(doc.save()).rejects.toThrow(/completedAt present but status/i);
  });

  it('bloqueia alterações após estados terminais', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatuses.CANCELLED;
    await doc.save();

    doc.status = PasswordResetStatuses.COMPLETED;
    await expect(doc.save()).rejects.toThrow(/terminal/i);
  });

  it('não deixa completedAt < initiatedAt', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatuses.VERIFIED;
    await doc.save();

    doc.status = PasswordResetStatuses.COMPLETED;
    // forçar incoerência
    doc.completedAt = new Date(doc.initiatedAt.getTime() - 60000);
    await expect(doc.save()).rejects.toThrow(/earlier than initiatedAt/i);
  });
});
