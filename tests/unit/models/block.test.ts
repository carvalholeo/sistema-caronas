import mongoose from "mongoose";
import { BlockModel } from "../../../src/models/block";
import { BlockStatus } from "../../../src/types/enums/enums";

describe("Block Model Integration Test", () => {
  // Limpa a coleção antes de cada teste para garantir isolamento
  afterEach(async () => {
    await BlockModel.deleteMany({});
  });

  // --- Funções Auxiliares ---
  const createBlockData = () => ({
    blockerUser: new mongoose.Types.ObjectId(),
    blockedUser: new mongoose.Types.ObjectId(),
    reason: "spam",
  });

  // --- Testes da Lógica de Negócio Real ---

  it('deve criar um bloqueio com o status "applied" por padrão', async () => {
    // Act
    const block = await BlockModel.create(createBlockData());

    // Assert
    expect(block.status).toBe(BlockStatus.APPLIED);
    expect(block.createdAt).toBeInstanceOf(Date);
  });

  it('deve falhar ao tentar criar um bloqueio com um status inicial diferente de "applied"', async () => {
    // Arrange
    const blockData = { ...createBlockData(), status: BlockStatus.REVERSED };
    const block = new BlockModel(blockData);

    // Act & Assert
    // O hook pre('validate') será acionado aqui e lançará o erro.
    await expect(block.save()).rejects.toThrow(/Invalid initial status/i);
  });

  it("deve falhar se o blockerUser for igual ao blockedUser", async () => {
    // Arrange
    const userId = new mongoose.Types.ObjectId();
    const blockData = {
      blockerUser: userId,
      blockedUser: userId,
      reason: "self-block",
    };
    const block = new BlockModel(blockData);

    // Act & Assert
    await expect(block.save()).rejects.toThrow(
      /blockedUser must be different from blockerUser/i,
    );
  });

  it('deve permitir a transição de "applied" para "reversed"', async () => {
    // Arrange
    const block = await BlockModel.create(createBlockData());
    expect(block.status).toBe(BlockStatus.APPLIED);

    // Act
    block.status = BlockStatus.REVERSED;
    const updatedBlock = await block.save();

    // Assert
    expect(updatedBlock.status).toBe(BlockStatus.REVERSED);
  });

  it("deve bloquear transições a partir de um estado terminal (ex: REVERSED)", async () => {
    // Arrange
    let block = await BlockModel.create(createBlockData());
    block.status = BlockStatus.REVERSED;
    await block.save();

    // Act & Assert
    block.status = BlockStatus.APPLIED; // Tenta fazer uma transição inválida
    await expect(block.save()).rejects.toThrow(/Block is terminal/i);
  });

  describe("Unique Partial Index", () => {
    it('deve impedir a criação de um segundo bloqueio "applied" para o mesmo par de usuários', async () => {
      // Arrange
      const blockData = createBlockData();
      await BlockModel.create(blockData); // Cria o primeiro bloqueio

      // Act & Assert
      // O motor do MongoDB vai disparar o erro de chave duplicada aqui.
      await expect(BlockModel.create(blockData)).rejects.toThrow(
        /E11000 duplicate key error/,
      );
    });

    it('deve PERMITIR a criação de um novo bloqueio "applied" se o anterior foi revertido', async () => {
      // Arrange
      const blockData = createBlockData();
      const firstBlock = await BlockModel.create(blockData);

      // Reverte o primeiro bloqueio
      firstBlock.status = BlockStatus.REVERSED;
      await firstBlock.save();

      // Act: Tenta criar um novo bloqueio para o mesmo par
      const secondBlock = await BlockModel.create({
        ...blockData,
        reason: "recidivism",
      });

      // Assert
      expect(secondBlock).toBeDefined();
      expect(secondBlock.status).toBe(BlockStatus.APPLIED);
      expect(secondBlock.reason).toBe("recidivism");
    });
  });
});
