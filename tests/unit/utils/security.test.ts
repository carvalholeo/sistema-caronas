
import { generateToken, verifyToken } from '../../../src/utils/security';
import jwt from 'jsonwebtoken';
import authConfig from '../../../src/config/auth';
import { IUser } from '../../../src/types';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/config/auth', () => ({
  __esModule: true,
  default: { jwtSecret: 'test-secret' },
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Security Utils', () => {
  const mockUser: IUser = {
    _id: 'user123',
    email: 'test@example.com',
    roles: ['user'],
  } as IUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a JWT token with correct payload and options', () => {
      const expiresIn = '1h';
      const otherOptions = { audience: 'web' };
      mockedJwt.sign.mockReturnValue('mock-jwt-token');

      const token = generateToken(mockUser, expiresIn, otherOptions);

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        { id: mockUser._id, email: mockUser.email, role: mockUser.roles },
        authConfig.jwtSecret,
        {
          ...otherOptions,
          expiresIn: expiresIn,
          notBefore: '0s',
        }
      );
      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('verifyToken', () => {
    it('should resolve with decoded payload for a valid token', async () => {
      const token = 'valid-jwt-token';
      const decodedPayload = { id: 'user123', email: 'test@example.com' };
      mockedJwt.verify.mockImplementation((t, secret, callback) => {
        (callback as Function)(null, decodedPayload);
      });

      const result = await verifyToken(token);

      expect(mockedJwt.verify).toHaveBeenCalledWith(token, authConfig.jwtSecret, expect.any(Function));
      expect(result).toEqual(decodedPayload);
    });

    it('should reject with an error for an invalid token', async () => {
      const token = 'invalid-jwt-token';
      const error = new Error('Invalid token');
      mockedJwt.verify.mockImplementation((t, secret, callback) => {
        (callback as Function)(error);
      });

      await expect(verifyToken(token)).rejects.toThrow('Invalid token');
      expect(mockedJwt.verify).toHaveBeenCalledWith(token, authConfig.jwtSecret, expect.any(Function));
    });
  });
});
