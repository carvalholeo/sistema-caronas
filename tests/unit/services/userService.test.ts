import { UserService } from '../../../src/services/userService';
import { UserModel } from '../../../src/models/user';
import { IUser } from '../../../src/types';
import { UserStatus } from '../../../src/types/enums/enums';
import { LocalStorageProvider } from '../../../src/providers/storage/LocalStorageProvider';
import { S3StorageProvider } from '../../../src/providers/storage/S3StorageProvider';
import { isCloudUploadDestination } from '../../../src/config/uploadAndMulter';
import { Readable } from 'stream';

// Mocking de TODAS as dependências externas
jest.mock('../../../src/models/user');
jest.mock('../../../src/providers/storage/LocalStorageProvider');
jest.mock('../../../src/providers/storage/S3StorageProvider');
jest.mock('../../../src/config/uploadAndMulter');

// Tipos mockados
const MockedUserModel = UserModel as jest.MockedClass<typeof UserModel>;
const MockedLocalStorageProvider = LocalStorageProvider as jest.MockedClass<typeof LocalStorageProvider>;
const MockedS3StorageProvider = S3StorageProvider as jest.MockedClass<typeof S3StorageProvider>;
// we'll set the exported flag directly in tests when needed

describe('UserService', () => {
  let userService: UserService;
  let mockStorageProvider: any;

  // Dados de teste padronizados
  const mockUser: Partial<IUser> = {
    _id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    matricula: '12345',
    profilePictureUrl: undefined,
    roles: [],
    status: UserStatus.Approved,
    comparePassword: jest.fn(),
    save: jest.fn()
  };

  const mockUserData: Partial<IUser> = {
    email: 'newuser@example.com',
    name: 'New User',
    matricula: '54321',
    roles: [],
    status: UserStatus.Pending
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'profilePicture',
    originalname: 'profile.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '/uploads',
    filename: 'profile123.jpg',
    path: '/uploads/profile123.jpg',
    buffer: Buffer.from('fake-image-data'),
    stream: new Readable()
  } as Express.Multer.File;

  beforeEach(() => {
    // Limpar todos os mocks antes de cada teste para garantir isolamento
    jest.clearAllMocks();

    // Configurar mock do storage provider
    mockStorageProvider = {
      saveFile: jest.fn(),
      deleteFile: jest.fn()
    };

    // Resetar configuração padrão
    (isCloudUploadDestination as unknown as boolean) = false;
    (MockedLocalStorageProvider as unknown as jest.Mock).mockImplementation(() => mockStorageProvider as unknown as LocalStorageProvider);

    // Criar nova instância para cada teste
    userService = new UserService();
  });

  describe('Constructor', () => {
    it('should initialize with LocalStorageProvider when cloud upload is disabled', () => {
      // Arrange
      (isCloudUploadDestination as unknown as boolean) = false;
      MockedLocalStorageProvider.mockClear();
      MockedS3StorageProvider.mockClear();

      // Act (construct to trigger provider selection)
      new UserService();

      // Assert
      expect(MockedLocalStorageProvider).toHaveBeenCalledTimes(1);
      expect(MockedS3StorageProvider).not.toHaveBeenCalled();
    });

    it('should initialize with S3StorageProvider when cloud upload is enabled', () => {
      // Arrange
      (isCloudUploadDestination as unknown as boolean) = true;
      MockedLocalStorageProvider.mockClear();
      MockedS3StorageProvider.mockClear();
      MockedS3StorageProvider.mockImplementation(() => mockStorageProvider);

      // Act (construct to trigger provider selection)
      new UserService();

      // Assert
      expect(MockedS3StorageProvider).toHaveBeenCalledTimes(1);
      expect(MockedLocalStorageProvider).not.toHaveBeenCalled();
    });
  });

  describe('updateProfilePicture', () => {
    it('should successfully update profile picture for user without existing picture', async () => {
      // Arrange
      const userWithoutPicture = {
        ...mockUser,
        profilePictureUrl: null,
        save: jest.fn().mockResolvedValue(mockUser)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithoutPicture as unknown as Partial<IUser>);
      mockStorageProvider.saveFile.mockResolvedValue('https://storage.com/new-picture.jpg');

      // Act
      const result = await userService.updateProfilePicture('user123', mockFile);

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('user123');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
      expect(mockStorageProvider.deleteFile).not.toHaveBeenCalled();
      expect(mockStorageProvider.saveFile).toHaveBeenCalledWith(mockFile);
      expect(mockStorageProvider.saveFile).toHaveBeenCalledTimes(1);
      expect(userWithoutPicture.profilePictureUrl).toBe('https://storage.com/new-picture.jpg');
      expect(userWithoutPicture.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(userWithoutPicture);
    });

    it('should successfully update profile picture and delete old picture', async () => {
      // Arrange
      const userWithPicture = {
        ...mockUser,
        profilePictureUrl: 'https://storage.com/old-picture.jpg',
        save: jest.fn().mockResolvedValue(mockUser)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPicture as Partial<IUser>);
      mockStorageProvider.deleteFile.mockResolvedValue(undefined);
      mockStorageProvider.saveFile.mockResolvedValue('https://storage.com/new-picture.jpg');

      // Act
      await userService.updateProfilePicture('user123', mockFile);

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('user123');
      expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith('https://storage.com/old-picture.jpg');
      expect(mockStorageProvider.deleteFile).toHaveBeenCalledTimes(1);
      expect(mockStorageProvider.saveFile).toHaveBeenCalledWith(mockFile);
      expect(mockStorageProvider.saveFile).toHaveBeenCalledTimes(1);
      expect(userWithPicture.profilePictureUrl).toBe('https://storage.com/new-picture.jpg');
      expect(userWithPicture.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error when user is not found', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateProfilePicture('nonexistent', mockFile))
        .rejects
        .toThrow('Usuário não encontrado.');

      expect(MockedUserModel.findById).toHaveBeenCalledWith('nonexistent');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
      expect(mockStorageProvider.saveFile).not.toHaveBeenCalled();
      expect(mockStorageProvider.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle storage provider saveFile failure', async () => {
      // Arrange
      const userWithoutPicture = {
        ...mockUser,
        profilePictureUrl: null,
        save: jest.fn()
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithoutPicture as unknown as Partial<IUser>);
      mockStorageProvider.saveFile.mockRejectedValue(new Error('Storage save failed'));

      // Act & Assert
      await expect(userService.updateProfilePicture('user123', mockFile))
        .rejects
        .toThrow('Storage save failed');

      expect(mockStorageProvider.saveFile).toHaveBeenCalledWith(mockFile);
      expect(mockStorageProvider.saveFile).toHaveBeenCalledTimes(1);
      expect(userWithoutPicture.save).not.toHaveBeenCalled();
    });

    it('should handle storage provider deleteFile failure', async () => {
      // Arrange
      const userWithPicture = {
        ...mockUser,
        profilePictureUrl: 'https://storage.com/old-picture.jpg',
        save: jest.fn()
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPicture as Partial<IUser>);
      mockStorageProvider.deleteFile.mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      await expect(userService.updateProfilePicture('user123', mockFile))
        .rejects
        .toThrow('Delete failed');

      expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith('https://storage.com/old-picture.jpg');
      expect(mockStorageProvider.deleteFile).toHaveBeenCalledTimes(1);
      expect(mockStorageProvider.saveFile).not.toHaveBeenCalled();
      expect(userWithPicture.save).not.toHaveBeenCalled();
    });

    it('should handle user save failure', async () => {
      // Arrange
      const userWithError = {
        ...mockUser,
        profilePictureUrl: null,
        save: jest.fn().mockRejectedValue(new Error('Database save failed'))
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithError as unknown as Partial<IUser>);
      mockStorageProvider.saveFile.mockResolvedValue('https://storage.com/new-picture.jpg');

      // Act & Assert
      await expect(userService.updateProfilePicture('user123', mockFile))
        .rejects
        .toThrow('Database save failed');

      expect(userWithError.profilePictureUrl).toBe('https://storage.com/new-picture.jpg');
      expect(userWithError.save).toHaveBeenCalledTimes(1);
    });

    it('should handle empty file buffer', async () => {
      // Arrange
      const emptyFile: Express.Multer.File = {
        ...mockFile,
        size: 0,
        buffer: Buffer.alloc(0)
      };

      const userWithoutPicture = {
        ...mockUser,
        profilePictureUrl: null,
        save: jest.fn().mockResolvedValue(mockUser)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithoutPicture as unknown as Partial<IUser>);
      mockStorageProvider.saveFile.mockResolvedValue('https://storage.com/empty-file.jpg');

      // Act
      const result = await userService.updateProfilePicture('user123', emptyFile);

      // Assert
      expect(mockStorageProvider.saveFile).toHaveBeenCalledWith(emptyFile);
      expect(result.profilePictureUrl).toBe('https://storage.com/empty-file.jpg');
    });

    it('should handle null file parameter', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(mockUser as Partial<IUser>);

      // Act & Assert
      expect(userService.updateProfilePicture('user123', null as unknown as Express.Multer.File)).rejects.toThrow('Invalid file')
    });
  });

  describe('createUser', () => {
    it('should successfully create a new user', async () => {
      // Arrange
      const mockUserInstance = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(mockUser)
      };
      (MockedUserModel as unknown as jest.Mock).mockImplementation(() => mockUserInstance as unknown as IUser);

      // Act
      const result = await userService.createUser(mockUserData as unknown as IUser);

      // Assert
      expect(MockedUserModel).toHaveBeenCalledWith({ ...mockUserData });
      expect(MockedUserModel).toHaveBeenCalledTimes(1);
      expect(mockUserInstance.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockUser);
    });

    it('should handle database save failure during user creation', async () => {
      // Arrange
      const mockUserInstance = {
        save: jest.fn().mockRejectedValue(new Error('Database constraint violation'))
      };
      (MockedUserModel as unknown as jest.Mock).mockImplementation(() => mockUserInstance as unknown as IUser);

      // Act & Assert
      await expect(userService.createUser(mockUserData as unknown as IUser))
        .rejects
        .toThrow('Database constraint violation');

      expect(MockedUserModel).toHaveBeenCalledWith({ ...mockUserData });
      expect(mockUserInstance.save).toHaveBeenCalledTimes(1);
    });

    it('should create user with minimal data', async () => {
      // Arrange
      const minimalUserData: IUser = {
        email: 'minimal@test.com'
      } as IUser;
      const mockUserInstance = {
        save: jest.fn().mockResolvedValue(minimalUserData)
      };
      (MockedUserModel as unknown as jest.Mock).mockImplementation(() => mockUserInstance as unknown as IUser);

      // Act
      const result = await userService.createUser(minimalUserData);

      // Assert
      expect(MockedUserModel).toHaveBeenCalledWith({ ...minimalUserData });
      expect(result).toBe(minimalUserData);
    });

    it('should handle UserModel constructor failure', async () => {
      // Arrange
      (MockedUserModel as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('UserModel constructor failed');
      });

      // Act & Assert
      await expect(userService.createUser(mockUserData as unknown as IUser))
        .rejects
        .toThrow('UserModel constructor failed');

      expect(MockedUserModel).toHaveBeenCalledWith({ ...mockUserData });
    });
  });

  describe('getUserById', () => {
    it('should successfully retrieve user by ID', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(mockUser as Partial<IUser>);

      // Act
      const result = await userService.getUserById('user123');

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('user123');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockUser);
    });

    it('should return null when user is not found', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.getUserById('nonexistent');

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('nonexistent');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should handle database connection failure', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(userService.getUserById('user123'))
        .rejects
        .toThrow('Database connection failed');

      expect(MockedUserModel.findById).toHaveBeenCalledWith('user123');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
    });

    it('should handle empty user ID', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.getUserById('');

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('');
      expect(result).toBeNull();
    });

    it('should handle undefined user ID', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.getUserById(undefined as unknown as string);

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith(undefined);
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should successfully update user with provided data', async () => {
      // Arrange
      const updateData: Partial<IUser> = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      const updatedUser = { ...mockUser, ...updateData } as Partial<IUser>;
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUser('user123', updateData);

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        updateData,
        { new: true }
      );
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(result).toBe(updatedUser);
    });

    it('should return null when user to update is not found', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.updateUser('nonexistent', { name: 'New Name' });

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'nonexistent',
        { name: 'New Name' },
        { new: true }
      );
      expect(result).toBeNull();
    });

    it('should handle database update failure', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('Update constraint violation'));

      // Act & Assert
      await expect(userService.updateUser('user123', { name: 'Updated Name' }))
        .rejects
        .toThrow('Update constraint violation');

      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('should handle empty update data', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser as Partial<IUser>);

      // Act
      const result = await userService.updateUser('user123', {});

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        {},
        { new: true }
      );
      expect(result).toBe(mockUser);
    });

    it('should handle null update data', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser as Partial<IUser>);

      // Act
      const result = await userService.updateUser('user123', null as unknown as Partial<IUser>);

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        null,
        { new: true }
      );
      expect(result).toBe(mockUser);
    });
  });

  describe('approveUser', () => {
    it('should successfully approve user', async () => {
      // Arrange
      const approvedUser = { ...mockUser, approved: true };
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(approvedUser as Partial<IUser>);

      // Act
      const result = await userService.approveUser('user123');

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { approved: true },
        { new: true }
      );
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(result).toBe(approvedUser);
    });

    it('should return null when user to approve is not found', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.approveUser('nonexistent');

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'nonexistent',
        { approved: true },
        { new: true }
      );
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should handle database approval failure', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('Approval process failed'));

      // Act & Assert
      await expect(userService.approveUser('user123'))
        .rejects
        .toThrow('Approval process failed');

      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('should handle empty user ID', async () => {
      // Arrange
      (MockedUserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.approveUser('');

      // Assert
      expect(MockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '',
        { approved: true },
        { new: true }
      );
      expect(result).toBeNull();
    });
  });

  describe('validateUserPassword', () => {
    it('should return true for valid password', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(true)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPassword as Partial<IUser>);

      // Act
      const result = await userService.validateUserPassword('user123', 'validPassword');

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('user123');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
      expect(userWithPassword.comparePassword).toHaveBeenCalledWith('validPassword');
      expect(userWithPassword.comparePassword).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(false)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPassword as Partial<IUser>);

      // Act
      const result = await userService.validateUserPassword('user123', 'invalidPassword');

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('user123');
      expect(userWithPassword.comparePassword).toHaveBeenCalledWith('invalidPassword');
      expect(result).toBe(false);
    });

    it('should return false when user is not found', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.validateUserPassword('nonexistent', 'anyPassword');

      // Assert
      expect(MockedUserModel.findById).toHaveBeenCalledWith('nonexistent');
      expect(MockedUserModel.findById).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('should handle password comparison failure', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockRejectedValue(new Error('Password comparison failed'))
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPassword as Partial<IUser>);

      // Act & Assert
      await expect(userService.validateUserPassword('user123', 'password'))
        .rejects
        .toThrow('Password comparison failed');

      expect(userWithPassword.comparePassword).toHaveBeenCalledTimes(1);
    });

    it('should handle empty password', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(false)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPassword as Partial<IUser>);

      // Act
      const result = await userService.validateUserPassword('user123', '');

      // Assert
      expect(userWithPassword.comparePassword).toHaveBeenCalledWith('');
      expect(result).toBe(false);
    });

    it('should handle getUserById failure', async () => {
      // Arrange
      (MockedUserModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userService.validateUserPassword('user123', 'password'))
        .rejects
        .toThrow('Database error');
    });

    it('should handle null password', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(false)
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(userWithPassword as Partial<IUser>);

      // Act
      const result = await userService.validateUserPassword('user123', null as unknown as string);

      // Assert
      expect(userWithPassword.comparePassword).toHaveBeenCalledWith(null);
      expect(result).toBe(false);
    });
  });
});
