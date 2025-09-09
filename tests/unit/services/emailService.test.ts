import { emailService } from '../../../src/services/emailService';
import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import juice from 'juice';
import logger from '../../../src/utils/logger';
import { EmailTemplate } from '../../../src/types/enums/email';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('path', () => ({
  __esModule: true,
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')), // Simple join for mocking
}));
jest.mock('handlebars');
jest.mock('juice');
jest.mock('../../../src/utils/logger');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;
const mockedHandlebars = handlebars as jest.Mocked<typeof handlebars>;
const mockedJuice = juice as jest.Mocked<typeof juice>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('EmailService', () => {
  let service: typeof emailService;

  beforeEach(() => {
    jest.resetModules(); // Reset module cache for fresh instance
    jest.clearAllMocks();

    // Mock path.join to return predictable paths
    mockedPath.join.mockImplementation((...args) => args.join('/'));

    // Mock handlebars.compile
    mockedHandlebars.compile.mockImplementation((template: string) => {
      if (template.includes('{{body}}')) {
        return jest.fn((data: any) => `LAYOUT: ${data.body}`);
      } else {
        return jest.fn((data: any) => `TEMPLATE(${template}): ${JSON.stringify(data)}`);
      }
    });

    // Mock juice
    mockedJuice.mockImplementation((html: string) => `JUICED(${html})`);

    // Mock fs.readFile for successful template loading
    mockedFs.readFile.mockImplementation((filePath: string) => {
      if (filePath.includes('base.hbs')) {
        return Promise.resolve('<html><body>{{body}}</body></html>');
      } else if (filePath.includes('PasswordResetRequest.hbs')) {
        return Promise.resolve('<h1>Reset</h1><p>{{userName}}</p>');
      } else {
        return Promise.resolve('Mock Template');
      }
    });

    // Re-import the service after mocks are set up
    service = require('../../../../src/services/emailService').emailService;
  });

  describe('Initialization', () => {
    it('should load and compile templates on instantiation', async () => {
      // Wait for the async initialization to complete
      // Accessing a private method for testing purposes
      await (service as any).initializeTemplates();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expect.stringContaining('base.hbs'), 'utf-8');
      expect(mockedFs.readFile).toHaveBeenCalledWith(expect.stringContaining('PasswordResetRequest.hbs'), 'utf-8');
      expect(mockedHandlebars.compile).toHaveBeenCalledTimes(Object.values(EmailTemplate).length + 1); // +1 for layout
      expect(mockedLogger.error).not.toHaveBeenCalled();
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it('should log a warning if a template file is not found', async () => {
      mockedFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('base.hbs')) return Promise.resolve('layout');
        if (filePath.includes('NonExistent.hbs')) return Promise.reject(new Error('File not found'));
        return Promise.resolve('Mock Template');
      });

      // Force re-initialization with the new mock
      service = require('../../../src/services/emailService').emailService;
      await (service as any).initializeTemplates();

      expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Template de e-mail não encontrado'));
    });

    it('should log an error if the base layout is not found', async () => {
        mockedFs.readFile.mockImplementation((filePath: string) => {
            if (filePath.includes('base.hbs')) return Promise.reject(new Error('Layout not found'));
            return Promise.resolve('Mock Template');
        });

        // Force re-initialization with the new mock
        service = require('../../../src/services/emailService').emailService;
        // The constructor catches the error, so we just check the logger
        await new Promise(resolve => setTimeout(resolve, 10)); // Give a moment for async error to be logged

        expect(mockedLogger.error).toHaveBeenCalledWith(expect.stringContaining('Erro ao inicializar templates'), expect.any(Error));
    });
  });

  describe('prepareEmailTemplate', () => {
    it('should throw an error if the template is not initialized', async () => {
      // Clear templates map to simulate uninitialized template
      (service as any).templates.clear();
      await expect(service.prepareEmailTemplate(EmailTemplate.PasswordResetRequest, { userName: 'Test' })).rejects.toThrow('Template de e-mail "PasswordResetRequest" não foi inicializado.');
    });

    it('should prepare the email with correct data and apply juice', async () => {
      // Ensure templates are initialized
      await (service as any).initializeTemplates();

      const data = { userName: 'John Doe', resetLink: 'http://reset.link' };
      const result = await service.prepareEmailTemplate(EmailTemplate.PasswordResetRequest, data);

      expect(mockedHandlebars.compile).toHaveBeenCalledWith(expect.stringContaining('<h1>Reset</h1><p>{{userName}}</p>'));
      expect(mockedHandlebars.compile).toHaveBeenCalledWith(expect.stringContaining('<html><body>{{body}}</body></html>'));

      // Check that the compiled template function was called with the data
      const templateFn = (mockedHandlebars.compile as jest.Mock).mock.results[1].value;
      expect(templateFn).toHaveBeenCalledWith(data);

      // Check that the layout function was called with the rendered body
      const layoutFn = (mockedHandlebars.compile as jest.Mock).mock.results[0].value;
      expect(layoutFn).toHaveBeenCalledWith({ body: `TEMPLATE(PasswordResetRequest): {"userName":"John Doe","resetLink":"http://reset.link"}` });

      // Check that juice was called with the full HTML
      expect(mockedJuice).toHaveBeenCalledWith('LAYOUT: TEMPLATE(PasswordResetRequest): {"userName":"John Doe","resetLink":"http://reset.link"}');
      expect(result).toBe('JUICED(LAYOUT: TEMPLATE(PasswordResetRequest): {"userName":"John Doe","resetLink":"http://reset.link"})');
    });
  });
});