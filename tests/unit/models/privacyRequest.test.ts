// test/privacy-request.test.ts
import mongoose from 'mongoose';
import { PrivacyRequestModel } from '../../../src/models/privacyRequest';
import { PrivacyRequestStatus } from '../../../src/types/enums/enums';

describe('PrivacyRequest state machine', () => {
  function newReq() {
    return new PrivacyRequestModel({
      user: new mongoose.Types.ObjectId(),
      type: 'removal',
    });
  }

  it('cria com status requested e requestedAt definido', async () => {
    const r = await newReq().save();
    expect(r.status).toBe(PrivacyRequestStatus.REQUESTED);
    expect(r.requestedAt).toBeInstanceOf(Date);
  });

  it('bloqueia status inicial diferente de requested', async () => {
    const r = new PrivacyRequestModel({
      user: new mongoose.Types.ObjectId(),
      type: 'access',
      status: PrivacyRequestStatus.INITIATED,
    });
    await expect(r.save()).rejects.toThrow(/Invalid initial status/i);
  });

  it('permite requested -> initiated', async () => {
    const r = await newReq().save();
    r.status = PrivacyRequestStatus.INITIATED;
    await expect(r.save()).resolves.toBeDefined();
  });

  it('permite initiated -> completed e seta completedAt', async () => {
    const r = await newReq().save();
    r.status = PrivacyRequestStatus.INITIATED;
    await r.save();
    r.status = PrivacyRequestStatus.COMPLETED;
    await expect(r.save()).resolves.toBeDefined();
    expect(r.completedAt).toBeInstanceOf(Date);
    expect(r.completedAt!.getTime()).toBeGreaterThanOrEqual(r.requestedAt.getTime());
  });

  it('bloqueia regressões para requested (pendente)', async () => {
    const r = await newReq().save();
    r.status = PrivacyRequestStatus.INITIATED;
    await r.save();
    r.status = PrivacyRequestStatus.REQUESTED;
    await expect(r.save()).rejects.toThrow(/Invalid status transition/i);
  });

  it('marca completedAt em estados terminais denied/canceled/expired', async () => {
    const r1 = await newReq().save();
    r1.status = PrivacyRequestStatus.INITIATED;
    await r1.save();
    r1.status = PrivacyRequestStatus.DENIED;
    await r1.save();
    expect(r1.completedAt).toBeInstanceOf(Date);

    const r2 = await newReq().save();
    r2.status = PrivacyRequestStatus.INITIATED;
    await r2.save();
    r2.status = PrivacyRequestStatus.CANCELLED;
    await r2.save();
    expect(r2.completedAt).toBeInstanceOf(Date);

    const r3 = await newReq().save();
    r3.status = PrivacyRequestStatus.INITIATED;
    await r3.save();
    r3.status = PrivacyRequestStatus.EXPIRED;
    await r3.save();
    expect(r3.completedAt).toBeInstanceOf(Date);
  });

  it('impede modificar requestedAt após criação', async () => {
    const r = await newReq().save();
    const old = r.requestedAt;
    r.requestedAt = new Date(old.getTime() - 1000);
    await expect(r.save()).rejects.toThrow(/requestedAt cannot be modified/i);
  });

  it('valida completedAt >= requestedAt', async () => {
    const r = await newReq().save();
    r.status = PrivacyRequestStatus.INITIATED;
    await r.save();
    r.status = PrivacyRequestStatus.COMPLETED;
    r.completedAt = new Date(r.requestedAt.getTime() - 1000); // forçar erro
    await expect(r.save()).rejects.toThrow(/earlier than requestedAt/i);
  });
});
