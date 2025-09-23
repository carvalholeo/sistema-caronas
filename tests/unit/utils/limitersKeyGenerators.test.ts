import { loginKeyGenerator, limiterKeyGenerator } from '../../../src/utils/limitersKeyGenerators';
import { Request } from 'express';

const mockUpdate = jest.fn().mockReturnThis();
const mockDigest = jest.fn((format) => `hashed_${format}`);

// Mockamos as dependências externas
jest.mock('crypto', () => ({
    createHash: jest.fn(() => ({
        update: mockUpdate,
        digest: mockDigest,
    })),
}));

jest.mock('express-rate-limit', () => ({
    ipKeyGenerator: jest.fn((ip) => `ip_${ip}`),
}));

describe('Limiter Key Generators', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('limiterKeyGenerator', () => {
        it('deve gerar uma chave baseada no IP e no email se o usuário NÃO estiver logado', () => {
            // Arrange
            const mockReq = {
                ip: '123.123.123.123',
                body: { email: 'test@example.com' },
            } as unknown as Request;

            // Act
            const key = limiterKeyGenerator(mockReq);

            // Assert
            expect(key).toBe('hashed_hex');

            // 3. Verificamos diretamente a função mock compartilhada.
            const hashInput = mockUpdate.mock.calls[0][0];
            expect(hashInput).toBe('test@example.com:ip_123.123.123.123');
        });

        it('deve usar o email do body mesmo se o usuário estiver logado (devido à sobrescrita no código original)', () => {
            // Arrange
            const mockReq = {
                ip: '1.1.1.1',
                body: { email: 'body@email.com' },
                user: { id: 'user-123' },
            } as unknown as Request;

            // Act
            limiterKeyGenerator(mockReq);

            // Assert
            const hashInput = mockUpdate.mock.calls[0][0];
            expect(hashInput).toBe('body@email.com:ip_1.1.1.1');
        });
    });

    describe('loginKeyGenerator', () => {
        it('deve gerar uma chave baseada no IP e no email do body', () => {
            // Arrange
            const mockReq = {
                ip: '123.123.123.123',
                body: { email: 'login@example.com' },
            } as unknown as Request;

            // Act
            const key = loginKeyGenerator(mockReq);

            // Assert
            expect(key).toBe('hashed_hex');
            const hashInput = mockUpdate.mock.calls[0][0];
            expect(hashInput).toBe('login@example.com:ip_123.123.123.123');
        });

        it('deve gerar uma chave baseada apenas no IP se o email não for fornecido', () => {
            // Arrange
            const mockReq = {
                ip: '123.123.123.123',
                body: {}, // Sem email
            } as unknown as Request;

            // Act
            const key = loginKeyGenerator(mockReq);

            // Assert
            expect(key).toBe('hashed_hex');
            const hashInput = mockUpdate.mock.calls[0][0];
            expect(hashInput).toBe(':ip_123.123.123.123');
        });
    });
});
