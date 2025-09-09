
import { EmailProvider } from '../../../../src/providers/notifications/EmailProvider';
import nodemailer from 'nodemailer';
import logger from '../../../../src/utils/logger';
import { INotificationPayload, INotificationSubscription } from '../../../../src/types';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../../../src/utils/logger');

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('EmailProvider', () => {
  const originalEnv = process.env;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockSendMail = jest.fn();
    (mockedNodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setValidEnv = () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.SMTP_FROM_EMAIL = 'noreply@example.com';
  };

  describe('Constructor', () => {
    it('should create a nodemailer transporter with correct options', () => {
      setValidEnv();
      new EmailProvider();
      expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user',
          pass: 'pass',
        },
      });
    });
  });

  describe('send', () => {
    const mockSubscription: INotificationSubscription = {
        user: 'user-id',
        destination: 'test@example.com',
    } as any;
    const mockPayload: INotificationPayload = {
        title: 'Email Title',
        body: 'Email Body',
        category: 'test-category',
        url: 'https://example.com/details'
    };

    it('should not send if destination (email) is missing', async () => {
        setValidEnv();
        const provider = new EmailProvider();
        const subWithoutDest = { ...mockSubscription, destination: undefined };
        await provider.send(subWithoutDest, mockPayload);

        expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('sem endereço'));
        expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should send an email with correct options', async () => {
        setValidEnv();
        const provider = new EmailProvider();
        mockSendMail.mockResolvedValue({});

        await provider.send(mockSubscription, mockPayload);

        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const mailOptions = mockSendMail.mock.calls[0][0];
        expect(mailOptions.to).toBe('test@example.com');
        expect(mailOptions.subject).toBe('Email Title');
        expect(mailOptions.html).toContain('https://example.com/details');
    });

    it('should log an error if sending fails', async () => {
        setValidEnv();
        const provider = new EmailProvider();
        const sendError = new Error('SMTP Error');
        mockSendMail.mockRejectedValue(sendError);

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.error).toHaveBeenCalledWith(expect.stringContaining('Erro ao enviar e-mail'), sendError);
    });
  });
});
