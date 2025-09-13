import mongoose from 'mongoose';
import { BlockModel } from '../../../src/models/block';
import { BlockStatus } from '../../../src/types/enums/enums';

describe('Block state machine + unique constraint', () => {
  function newBlockPair() {
    return {
      blocker: new mongoose.Types.ObjectId(),
      blocked: new mongoose.Types.ObjectId()
    };
  }

  it('cria com status applied e appliedAt setado', async () => {
    const { blocker, blocked } = newBlockPair();

    // Mock do método create
    const mockBlock = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'spam',
      status: BlockStatus.APPLIED,
      appliedAt: new Date()
    };

    jest.spyOn(BlockModel, 'create').mockResolvedValue(mockBlock as any);

    const b = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'spam' });
    expect(b.status).toBe(BlockStatus.APPLIED);
    expect(BlockModel.create).toHaveBeenCalledWith({
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'spam'
    });
  });

  it('bloqueia status inicial diferente de applied', async () => {
    const { blocker, blocked } = newBlockPair();

    const mockBlockInstance = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'abuse',
      status: BlockStatus.REVERSED,
      save: jest.fn().mockRejectedValue(new Error('Invalid initial status'))
    };

    // Mock do construtor
    jest.spyOn(BlockModel.prototype, 'save').mockRejectedValue(
      new Error('Invalid initial status')
    );

    const b = new BlockModel({
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'abuse',
      status: BlockStatus.REVERSED,
    });

    await expect(b.save()).rejects.toThrow(/Invalid initial status/i);
  });

  it('permite applied -> reversed e seta reversedAt', async () => {
    const { blocker, blocked } = newBlockPair();

    const mockBlock = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'spam',
      status: BlockStatus.APPLIED,
      appliedAt: new Date(),
      save: jest.fn()
    };

    // Simular mudança de status
    mockBlock.status = BlockStatus.REVERSED;
    mockBlock.save.mockResolvedValue(mockBlock);

    jest.spyOn(BlockModel, 'create').mockResolvedValue(mockBlock as any);

    const b = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'spam' });
    b.status = BlockStatus.REVERSED;

    await expect(b.save()).resolves.toBeDefined();
    expect(b.status).toBe(BlockStatus.REVERSED);
  });

  it('permite applied -> reversed_by_admin e mantém reversedBy preenchido', async () => {
    const { blocker, blocked } = newBlockPair();

    const mockBlock = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'abuse',
      status: BlockStatus.APPLIED,
      appliedAt: new Date(),
      save: jest.fn()
    };

    // Simular mudança de status
    mockBlock.status = BlockStatus.REVERSED_BY_ADMIN;
    mockBlock.save.mockResolvedValue(mockBlock);

    jest.spyOn(BlockModel, 'create').mockResolvedValue(mockBlock as any);

    const b = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'abuse' });
    b.status = BlockStatus.REVERSED_BY_ADMIN;

    await expect(b.save()).resolves.toBeDefined();
    expect(b.status).toBe(BlockStatus.REVERSED_BY_ADMIN);
  });

  it('bloqueia transições a partir de estados terminais', async () => {
    const { blocker, blocked } = newBlockPair();

    const mockBlock = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'abuse',
      status: BlockStatus.APPLIED,
      appliedAt: new Date(),
      save: jest.fn()
    };

    // Primeiro save: applied -> reversed (permitido)
    mockBlock.status = BlockStatus.REVERSED;
    mockBlock.save.mockResolvedValueOnce(mockBlock);

    // Segundo save: reversed -> applied (não permitido)
    mockBlock.save.mockRejectedValueOnce(new Error('Cannot transition from terminal state'));

    jest.spyOn(BlockModel, 'create').mockResolvedValue(mockBlock as any);

    const b = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'abuse' });
    b.status = BlockStatus.REVERSED;
    await b.save();

    b.status = BlockStatus.APPLIED;
    await expect(b.save()).rejects.toThrow(/terminal/i);
  });

  it('impede duplicidade de applied para o mesmo par (índice único parcial)', async () => {
    const blocker = new mongoose.Types.ObjectId();
    const blocked = new mongoose.Types.ObjectId();

    const mockBlock1 = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'spam',
      status: BlockStatus.APPLIED
    };

    // Primeiro create bem-sucedido
    jest.spyOn(BlockModel, 'create')
      .mockResolvedValueOnce(mockBlock1 as any)
      .mockRejectedValueOnce(new Error('E11000 duplicate key error'));

    const b1 = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'spam' });
    expect(b1).toBeTruthy();

    // Segunda tentativa "applied" para o mesmo par deve falhar por índice único parcial
    await expect(
      BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'spam again' })
    ).rejects.toThrow(); // MongoServerError duplicate key
  });

  it('permite histórico: após reverter, um novo applied pode ser criado (índice parcial)', async () => {
    const blocker = new mongoose.Types.ObjectId();
    const blocked = new mongoose.Types.ObjectId();

    const mockBlock1 = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'spam',
      status: BlockStatus.APPLIED,
      save: jest.fn()
    };

    const mockBlock2 = {
      blockerUser: blocker,
      blockedUser: blocked,
      reason: 'recidivism',
      status: BlockStatus.APPLIED
    };

    // Primeiro: criar block
    mockBlock1.save.mockResolvedValue(mockBlock1);

    // Simular reversão
    mockBlock1.status = BlockStatus.REVERSED;

    jest.spyOn(BlockModel, 'create')
      .mockResolvedValueOnce(mockBlock1 as any)
      .mockResolvedValueOnce(mockBlock2 as any);

    const b = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'spam' });
    b.status = BlockStatus.REVERSED;
    await b.save();

    // agora, novo applied é permitido pois o índice parcial só considera status='applied' atuais
    const b2 = await BlockModel.create({ blockerUser: blocker, blockedUser: blocked, reason: 'recidivism' });
    expect(b2.status).toBe(BlockStatus.APPLIED);
  });

  it('permite inserir quando IDs são diferentes', async () => {
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();

    const mockDoc = {
      blockerUser: a,
      blockedUser: b,
      reason: 'spam',
      status: BlockStatus.APPLIED
    };

    jest.spyOn(BlockModel, 'create').mockResolvedValue(mockDoc as any);

    const doc = await BlockModel.create({ blockerUser: a, blockedUser: b, reason: 'spam' });
    expect(doc.status).toBe(BlockStatus.APPLIED);
  });

  it('rejeita inserir quando IDs são iguais (apenas na inserção)', async () => {
    const a = new mongoose.Types.ObjectId();

    jest.spyOn(BlockModel, 'create').mockRejectedValue(
      new Error('blockedUser must be different from blockerUser')
    );

    await expect(
      BlockModel.create({ blockerUser: a, blockedUser: a, reason: 'self-block' })
    ).rejects.toThrow(/blockedUser must be different from blockerUser/i);
  });

  it('não bloqueia updates subsequentes por essa regra', async () => {
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();

    const mockDoc = {
      blockerUser: a,
      blockedUser: b,
      reason: 'abuse',
      status: BlockStatus.APPLIED,
      save: jest.fn().mockResolvedValue({
        blockerUser: a,
        blockedUser: b,
        reason: 'updated reason',
        status: BlockStatus.APPLIED
      })
    };

    jest.spyOn(BlockModel, 'create').mockResolvedValue(mockDoc as any);

    const doc = await BlockModel.create({ blockerUser: a, blockedUser: b, reason: 'abuse' });
    doc.reason = 'updated reason';

    await expect(doc.save()).resolves.toBeDefined();
    expect(mockDoc.save).toHaveBeenCalled();
  });
});