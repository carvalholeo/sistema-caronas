
import { validationResult } from 'express-validator';
import { subscribeValidator, updatePreferencesValidator } from '../../../../src/middlewares/validators/notification';
import { Request } from 'express';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Notification Validators', () => {

  describe('subscribeValidator', () => {
    it('should pass with valid web subscription data', async () => {
      const req = { body: { deviceIdentifier: 'web123', platform: 'web', endpoint: 'https://example.com', keys: {} } } as Request;
      const errors = await runValidation(req, subscribeValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass with valid ios subscription data', async () => {
        const req = { body: { deviceIdentifier: 'ios123', platform: 'ios', deviceToken: 'sometoken' } } as Request;
        const errors = await runValidation(req, subscribeValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if deviceIdentifier is missing', async () => {
      const req = { body: { platform: 'web', endpoint: 'https://example.com' } } as Request;
      const errors = await runValidation(req, subscribeValidator);
      expect(errors.array()[0].msg).toBe('O identificador do dispositivo é obrigatório.');
    });

    it('should fail with an invalid platform', async () => {
        const req = { body: { deviceIdentifier: 'abc', platform: 'windows' } } as Request;
        const errors = await runValidation(req, subscribeValidator);
        expect(errors.array()[0].msg).toBe('A plataforma especificada é inválida.');
    });
  });

  describe('updatePreferencesValidator', () => {
    it('should pass with valid kinds update', async () => {
      const req = { params: { deviceIdentifier: 'dev123' }, body: { kinds: { rides: true, chats: false } } } as unknown as Request;
      const errors = await runValidation(req, updatePreferencesValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass with valid quiet hours', async () => {
        const req = {
            params: { deviceIdentifier: 'dev123' },
            body: {
                quietHours: {
                    startHour: 22,
                    endHour: 8,
                    weekDays: [0, 1, 2, 3, 4, 5, 6],
                    timezone: 'UTC'
                }
            }
        } as unknown as Request;
        const errors = await runValidation(req, updatePreferencesValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if deviceIdentifier is missing from params', async () => {
        const req = { params: {}, body: {} } as unknown as Request;
        const errors = await runValidation(req, updatePreferencesValidator);
        expect(errors.array()[0].msg).toBe('O identificador do dispositivo é obrigatório na URL.');
    });

    it('should fail with invalid startHour in quietHours', async () => {
        const req = {
            params: { deviceIdentifier: 'dev123' },
            body: { quietHours: { startHour: 25 } }
        } as unknown as Request;
        const errors = await runValidation(req, updatePreferencesValidator);
        expect(errors.array()[0].msg).toBe('A hora de início deve ser entre 0 e 23.');
    });
  });
});
