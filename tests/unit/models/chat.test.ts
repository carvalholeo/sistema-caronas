// test/chat-message.test.ts
import mongoose, { Schema, model } from 'mongoose';
import { ChatMessageModel } from '../../../src/models/chat';
import { MessageStatus } from '../../../src/types/enums/enums'

describe('ChatMessage model', () => {
  const RideSchema = new Schema({
    driver: { type: Schema.Types.ObjectId, ref: 'User' },
    passengers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  });
  const RideModel = model('Ride', RideSchema);

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/chat-message-test', { dbName: 'chat-message-test' } as any);
    await RideModel.deleteMany({});
    await ChatMessageModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('valida conteúdo com Unicode e rejeita inválidos', async () => {
    const ride = await RideModel.create({ driver: new mongoose.Types.ObjectId(), passengers: [] });
    const sender = ride.driver;

    const ok = await ChatMessageModel.create({
      ride: ride._id,
      sender,
      content: 'Olá, mundo! — Привет',
    });
    expect(ok._id).toBeTruthy();

    await expect(
      ChatMessageModel.create({
        ride: ride._id,
        sender,
        content: 'Bad \u0001 control',
      })
    ).rejects.toThrow(/invalid characters/i);
  });

  it('impede enviar mensagem por usuário fora da ride', async () => {
    const ride = await RideModel.create({ driver: new mongoose.Types.ObjectId(), passengers: [] });
    const outsider = new mongoose.Types.ObjectId();
    await expect(
      ChatMessageModel.create({ ride: ride._id, sender: outsider, content: 'hi' })
    ).rejects.toThrow(/must be part of the ride/i);
  });

  it('permite transição Sent -> Received -> Read e seta timestamps', async () => {
    const driver = new mongoose.Types.ObjectId();
    const passenger = new mongoose.Types.ObjectId();
    const ride = await RideModel.create({ driver, passengers: [passenger] });

    const msg = await ChatMessageModel.create({ ride: ride._id, sender: passenger, content: 'hi' });
    expect(msg.status).toBe(MessageStatus.Sent);
    expect(msg.deliveredAt).toBeUndefined();

    msg.status = MessageStatus.Received;
    await msg.save();
    expect(msg.deliveredAt).toBeInstanceOf(Date);
    expect(msg.readAt).toBeUndefined();

    msg.status = MessageStatus.Read;
    await msg.save();
    expect(msg.readAt).toBeInstanceOf(Date);
    expect(msg.readAt!.getTime()).toBeGreaterThanOrEqual(msg.deliveredAt!.getTime());
  });

  it('bloqueia regressão de status (Read -> Sent)', async () => {
    const driver = new mongoose.Types.ObjectId();
    const passenger = new mongoose.Types.ObjectId();
    const ride = await RideModel.create({ driver, passengers: [passenger] });

    const msg = await ChatMessageModel.create({ ride: ride._id, sender: passenger, content: 'ok' });
    msg.status = MessageStatus.Read;
    await msg.save();

    msg.status = MessageStatus.Sent;
    await expect(msg.save()).rejects.toThrow(/Invalid status transition/i);
  });

  it('valida moderação condicional', async () => {
    const driver = new mongoose.Types.ObjectId();
    const passenger = new mongoose.Types.ObjectId();
    const ride = await RideModel.create({ driver, passengers: [passenger] });

    // faltar campos obrigatórios de moderação
    await expect(
      ChatMessageModel.create({
        ride: ride._id,
        sender: passenger,
        content: 'msg',
        isModerated: true,
        moderationDetails: { reason: 'profanity' },
      })
    ).rejects.toThrow(/moderationDetails\.(moderatedBy|moderatedAt|originalContent)/i);

    // preencher corretamente
    const modMsg = await ChatMessageModel.create({
      ride: ride._id,
      sender: passenger,
      content: 'clean',
      isModerated: true,
      moderationDetails: {
        originalContent: 'dirty',
        moderatedBy: driver,
        moderatedAt: new Date(),
        reason: 'policy',
      },
    });
    expect(modMsg._id).toBeTruthy();
  });
});
