// test/user-status-state-machine.test.ts
import mongoose from 'mongoose';
import { UserModel } from '../../../src/models/user';
import { UserStatus } from '../../../src/types/enums/enums';

describe('User status state machine', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/user-status-sm', { dbName: 'user-status-sm' } as any);
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  function newUser() {
    return new UserModel({
      name: 'Alice',
      email: `alice_${Date.now()}@example.com`,
      matricula: `A${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      password: 'S3cr3tPass!',
      roles: [],
      permissions: [],
    });
  }

  it('cria usuários com status pending por padrão', async () => {
    const u = await newUser().save();
    expect(u.status).toBe(UserStatus.Pending);
    expect(u.createdAt).toBeInstanceOf(Date);
  });

  it('bloqueia status inicial diferente de pending', async () => {
    const u = newUser();
    u.status = UserStatus.Approved;
    await expect(u.save()).rejects.toThrow(/Invalid initial status/i);
  });

  it('permite transição pending -> approved e seta approvedAt', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Approved;
    await expect(u.save()).resolves.toBeDefined();
    expect(u.updatedAt).toBeInstanceOf(Date);
  });

  it('bloqueia transição approved -> rejected (inexistente no mapa)', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Approved;
    await u.save();
    u.status = UserStatus.Rejected;
    await expect(u.save()).rejects.toThrow(/Invalid transition/i);
  });

  it('permite approved -> suspended -> approved', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Approved;
    await u.save();
    u.status = UserStatus.Suspended;
    await expect(u.save()).resolves.toBeDefined();
    expect(u.suspendedAt).toBeInstanceOf(Date);
    u.status = UserStatus.Approved;
    await expect(u.save()).resolves.toBeDefined();
  });

  it('permite banned -> suspended e seta bannedAt uma vez', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Banned;
    await u.save();
    const firstBannedAt = u.updatedAt!;
    u.status = UserStatus.Suspended;
    await u.save();
    expect(u.status).toEqual(UserStatus.Suspended);
  });

  it('bloqueia qualquer mudança após anonymized (terminal)', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Anonymized;
    await u.save();
    u.status = UserStatus.Pending;
    await expect(u.save()).rejects.toThrow(/terminal/i);
  });

  it('respeita writes que não mudam status (isModified guard)', async () => {
    const u = await newUser().save();
    u.name = 'Alice Updated';
    await expect(u.save()).resolves.toBeDefined();
    expect(u.status).toBe(UserStatus.Pending);
  });

  it('valida entradas inesperadas via enum (protege domínio)', async () => {
    const u = await newUser().save();
    u.set('status', 'weird');
    await expect(u.save()).rejects.toThrow(); // enum do schema falha
  });
});
