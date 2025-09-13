import { EmailService, emailService } from '../services/emailService';
import { EmailTemplate } from '../types/enums/email';
import { TemplateDataMap } from '../types/types/email';
import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import juice from 'juice';
import logger from '../utils/logger';

// Mocking de TODAS as dependências externas
jest.mock('fs/promises');
jest.mock('path');
jest.mock('handlebars');
jest.mock('juice');
jest.mock('../utils/logger');
jest.mock('../types/enums/email');

// Tipos mockados
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;
const mockedHandlebars = handlebars as jest.Mocked<typeof handlebars>;
const mockedJuice = juice as jest.MockedFunction<typeof juice>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('EmailService', () => {
  let emailServiceInstance: EmailService;

  // Mock templates e dados
  const mockLayoutTemplate = '<html><body>{{{body}}}</body></html>';
  const mockEmailTemplate = '<h1>Hello {{name}}</h1><p>{{message}}</p>';
  const mockCompiledLayout = jest.fn();
  const mockCompiledTemplate = jest.fn();

  // Mock enum values para controle nos testes
  const MockEmailTemplate = {
    WelcomeEmail: 'welcome-email',
    PasswordReset: 'password-reset',
    NotificationEmail: 'notification-email'
  } as typeof EmailTemplate;

  beforeEach(() => {
    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks();

    // Configurar mocks padrão
    setupDefaultMocks();
  });

  const setupDefaultMocks = () => {
    // Mock do path.join
    mockedPath.join.mockImplementation((...args) => args.join('/'));

    // Mock do fs.readFile
    mockedFs.readFile
      .mockResolvedValueOnce(mockLayoutTemplate) // Layout file
      .mockResolvedValue(mockEmailTemplate); // Template files

    // Mock do handlebars.compile
    mockedHandlebars.compile
      .mockReturnValueOnce(mockCompiledLayout) // Layout compilation
      .mockReturnValue(mockCompiledTemplate); // Template compilation

    // Mock do juice
    mockedJuice.mockReturnValue('<html><body><h1>Processed</h1></body></html>');

    // Mock do Object.values para o enum
    Object.values = jest.fn().mockReturnValue([
      MockEmailTemplate.WelcomeEmail,
      MockEmailTemplate.PasswordReset,
      MockEmailTemplate.NotificationEmail
    ]);

    // Mock das funções compiladas
    mockCompiledLayout.mockReturnValue('<html><body>Mock Layout with Body</body></html>');
    mockCompiledTemplate.mockReturnValue('<h1>Compiled Template Content</h1>');
  };

  describe('Constructor and Initialization', () => {
    it('should create EmailService instance and call initializeTemplates', () => {
      // Act
      emailServiceInstance = new EmailService();

      // Assert
      expect(emailServiceInstance).toBeInstanceOf(EmailService);
      // initializeTemplates é chamado no constructor, mas de forma assíncrona
    });

    it('should handle initializeTemplates error and log it', async () => {
      // Arrange
      mockedFs.readFile.mockRejectedValueOnce(new Error('File system error'));

      // Act
      emailServiceInstance = new EmailService();

      // Aguardar próximo tick para permitir que o catch seja executado
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Erro ao inicializar templates de e-mail:",
        expect.any(Error)
      );
    });
  });

  describe('initializeTemplates', () => {
    beforeEach(() => {
      emailServiceInstance = new EmailService();
    });

    it('should load layout template successfully', async () => {
      // Arrange
      const expectedLayoutPath = 'templates/emails/templates/layouts/base.hbs';

      // Act - Aguardar a inicialização
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedPath.join).toHaveBeenCalledWith(
        expect.any(String), // __dirname
        'templates',
        'emails'
      );
      expect(mockedPath.join).toHaveBeenCalledWith(
        expect.any(String), // templatesDir
        'templates',
        'layouts',
        'base.hbs'
      );
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('base.hbs'),
        'utf-8'
      );
      expect(mockedHandlebars.compile).toHaveBeenCalledWith(mockLayoutTemplate);
    });

    it('should load all individual templates successfully', async () => {
      // Act - Aguardar a inicialização
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(Object.values).toHaveBeenCalledWith(EmailTemplate);
      expect(mockedFs.readFile).toHaveBeenCalledTimes(4); // 1 layout + 3 templates
      expect(mockedHandlebars.compile).toHaveBeenCalledTimes(4); // 1 layout + 3 templates
    });

    it('should handle missing template files gracefully', async () => {
      // Arrange
      mockedFs.readFile
        .mockResolvedValueOnce(mockLayoutTemplate) // Layout succeeds
        .mockRejectedValueOnce(new Error('Template not found')) // First template fails
        .mockResolvedValueOnce(mockEmailTemplate) // Second template succeeds
        .mockResolvedValueOnce(mockEmailTemplate); // Third template succeeds

      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        `Template de e-mail não encontrado: ${MockEmailTemplate.WelcomeEmail}.hbs`
      );
      expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should handle layout file loading failure', async () => {
      // Arrange
      mockedFs.readFile.mockRejectedValueOnce(new Error('Layout file not found'));

      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Erro ao inicializar templates de e-mail:",
        expect.any(Error)
      );
    });

    it('should handle handlebars compilation failure', async () => {
      // Arrange
      mockedHandlebars.compile.mockImplementationOnce(() => {
        throw new Error('Compilation failed');
      });

      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Erro ao inicializar templates de e-mail:",
        expect.any(Error)
      );
    });

    it('should call fs.readFile with correct paths for each template', async () => {
      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('welcome-email.hbs'),
        'utf-8'
      );
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('password-reset.hbs'),
        'utf-8'
      );
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('notification-email.hbs'),
        'utf-8'
      );
    });

    it('should handle empty enum values', async () => {
      // Arrange
      Object.values = jest.fn().mockReturnValue([]);

      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedFs.readFile).toHaveBeenCalledTimes(1); // Only layout
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('prepareEmailTemplate', () => {
    beforeEach(async () => {
      emailServiceInstance = new EmailService();
      // Aguardar inicialização
      await new Promise(resolve => setTimeout(resolve, 0));
      jest.clearAllMocks(); // Limpar calls da inicialização
    });

    it('should prepare email template successfully', async () => {
      // Arrange
      const templateData = { name: 'John Doe', message: 'Welcome!' };
      const bodyHtml = '<h1>Hello John Doe</h1><p>Welcome!</p>';
      const fullHtml = '<html><body><h1>Hello John Doe</h1><p>Welcome!</p></body></html>';
      const finalHtml = '<html><body><h1>Processed Hello</h1></body></html>';

      mockCompiledTemplate.mockReturnValue(bodyHtml);
      mockCompiledLayout.mockReturnValue(fullHtml);
      mockedJuice.mockReturnValue(finalHtml);

      // Act
      const result = await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        templateData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(templateData);
      expect(mockCompiledLayout).toHaveBeenCalledWith({ body: bodyHtml });
      expect(mockedJuice).toHaveBeenCalledWith(fullHtml);
      expect(result).toBe(finalHtml);
    });

    it('should throw error when template is not initialized', async () => {
      // Arrange
      const nonExistentTemplate = 'non-existent-template' as any;
      const templateData = { name: 'Test' };

      // Act & Assert
      await expect(
        emailServiceInstance.prepareEmailTemplate(nonExistentTemplate, templateData as any)
      ).rejects.toThrow('Template de e-mail "non-existent-template" não foi inicializado.');
    });

    it('should handle template rendering with complex data', async () => {
      // Arrange
      const complexData = {
        name: 'John Doe',
        items: ['Item 1', 'Item 2', 'Item 3'],
        user: {
          id: 123,
          preferences: {
            theme: 'dark',
            language: 'en'
          }
        }
      };

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        complexData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(complexData);
    });

    it('should handle template rendering with null data', async () => {
      // Arrange
      const nullData = null;

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        nullData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(null);
    });

    it('should handle template rendering with undefined data', async () => {
      // Arrange
      const undefinedData = undefined;

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        undefinedData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(undefined);
    });

    it('should handle template rendering with empty object', async () => {
      // Arrange
      const emptyData = {};

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        emptyData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(emptyData);
    });

    it('should handle handlebars template execution failure', async () => {
      // Arrange
      const templateData = { name: 'Test' };
      mockCompiledTemplate.mockImplementation(() => {
        throw new Error('Template execution failed');
      });

      // Act & Assert
      await expect(
        emailServiceInstance.prepareEmailTemplate(
          MockEmailTemplate.WelcomeEmail as any,
          templateData as any
        )
      ).rejects.toThrow('Template execution failed');
    });

    it('should handle layout template execution failure', async () => {
      // Arrange
      const templateData = { name: 'Test' };
      mockCompiledLayout.mockImplementation(() => {
        throw new Error('Layout execution failed');
      });

      // Act & Assert
      await expect(
        emailServiceInstance.prepareEmailTemplate(
          MockEmailTemplate.WelcomeEmail as any,
          templateData as any
        )
      ).rejects.toThrow('Layout execution failed');
    });

    it('should handle juice CSS inlining failure', async () => {
      // Arrange
      const templateData = { name: 'Test' };
      mockedJuice.mockImplementation(() => {
        throw new Error('CSS inlining failed');
      });

      // Act & Assert
      await expect(
        emailServiceInstance.prepareEmailTemplate(
          MockEmailTemplate.WelcomeEmail as any,
          templateData as any
        )
      ).rejects.toThrow('CSS inlining failed');
    });

    it('should handle different template types', async () => {
      // Arrange
      const passwordResetData = { resetLink: 'http://example.com/reset', userName: 'John' };
      const notificationData = { title: 'New Message', content: 'You have a new message' };

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.PasswordReset as any,
        passwordResetData as any
      );

      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.NotificationEmail as any,
        notificationData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(passwordResetData);
      expect(mockCompiledTemplate).toHaveBeenCalledWith(notificationData);
      expect(mockCompiledTemplate).toHaveBeenCalledTimes(2);
    });

    it('should return processed HTML with inline CSS', async () => {
      // Arrange
      const templateData = { name: 'Test User' };
      const expectedProcessedHtml = '<html><head><style>body{color:red}</style></head><body><h1>Test</h1></body></html>';
      mockedJuice.mockReturnValue(expectedProcessedHtml);

      // Act
      const result = await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        templateData as any
      );

      // Assert
      expect(result).toBe(expectedProcessedHtml);
      expect(mockedJuice).toHaveBeenCalledTimes(1);
    });

    it('should handle string data types', async () => {
      // Arrange
      const stringData = 'Simple string data';

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        stringData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(stringData);
    });

    it('should handle number data types', async () => {
      // Arrange
      const numberData = 42;

      // Act
      await emailServiceInstance.prepareEmailTemplate(
        MockEmailTemplate.WelcomeEmail as any,
        numberData as any
      );

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledWith(numberData);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle __dirname being undefined', async () => {
      // Arrange
      const originalDirname = global.__dirname;
      delete (global as any).__dirname;

      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Restore
      (global as any).__dirname = originalDirname;

      // Assert
      expect(mockedPath.join).toHaveBeenCalled();
    });

    it('should handle Map operations correctly', async () => {
      // Arrange
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Act - Simulate template retrieval
      const retrievedTemplate = (emailServiceInstance as any).templates.get?.(MockEmailTemplate.WelcomeEmail);

      // Assert - Verificar que o Map foi usado (indiretamente através dos mocks)
      expect(mockedHandlebars.compile).toHaveBeenCalled();
    });

    it('should handle concurrent template preparations', async () => {
      // Arrange
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));
      jest.clearAllMocks();

      const templateData1 = { name: 'User 1' };
      const templateData2 = { name: 'User 2' };

      // Act
      const promises = [
        emailServiceInstance.prepareEmailTemplate(MockEmailTemplate.WelcomeEmail as any, templateData1 as any),
        emailServiceInstance.prepareEmailTemplate(MockEmailTemplate.PasswordReset as any, templateData2 as any)
      ];

      await Promise.all(promises);

      // Assert
      expect(mockCompiledTemplate).toHaveBeenCalledTimes(2);
      expect(mockCompiledLayout).toHaveBeenCalledTimes(2);
      expect(mockedJuice).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed template files', async () => {
      // Arrange
      const malformedTemplate = '<h1>{{unclosed handlebars';
      mockedFs.readFile
        .mockResolvedValueOnce(mockLayoutTemplate) // Layout OK
        .mockResolvedValueOnce(malformedTemplate); // Malformed template

      mockedHandlebars.compile
        .mockReturnValueOnce(mockCompiledLayout) // Layout OK
        .mockImplementationOnce(() => {
          throw new Error('Malformed template syntax');
        });

      // Act
      emailServiceInstance = new EmailService();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Erro ao inicializar templates de e-mail:",
        expect.any(Error)
      );
    });
  });
});
