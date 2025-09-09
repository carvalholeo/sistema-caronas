
import { UserService } from '../../../src/services/userService';
import { UserModel } from '../../../src/models/user';
import { LocalStorageProvider } from '../../../src/providers/storage/LocalStorageProvider';
import { S3StorageProvider } from '../../../src/providers/storage/S3StorageProvider';
import { isCloudUploadDestination } from '../../../src/config/uploadAndMulter';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/models/user');
jest.mock('../../../src/providers/storage/LocalStorageProvider');
jest.mock('../../../src/providers/storage/S3StorageProvider');
jest.mock('../../../src/config/uploadAndMulter');

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedLocalStorageProvider = LocalStorageProvider as jest.MockedClass<typeof LocalStorageProvider>;
const mockedS3StorageProvider = S3StorageProvider as jest.MockedClass<typeof S3StorageProvider>;
const mockedIsCloudUploadDestination = isCloudUploadDestination as jest.Mocked<typeof isCloudUploadDestination>;

describe('UserService', () => {
  let service: UserService;
  let mockUser: any;
  let mockStorageProvider: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Ensure a fresh instance of UserService

    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      profilePictureUrl: undefined,
      comparePassword: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
    };

    mockStorageProvider = {
      saveFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    mockedLocalStorageProvider.mockImplementation(() => mockStorageProvider);
    mockedS3StorageProvider.mockImplementation(() => mockStorageProvider);

    mockedUserModel.findById.mockResolvedValue(mockUser);
    mockedUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
    (mockedUserModel as jest.Mock).mockImplementation(() => mockUser);

    // Default to local storage for most tests unless specified
    mockedIsCloudUploadDestination.mockReturnValue(false);

    service = new UserService();
  });

  describe('Constructor', () => {
    it('should use LocalStorageProvider when not cloud destination', () => {
      expect(mockedLocalStorageProvider).toHaveBeenCalledTimes(1);
      expect(mockedS3StorageProvider).not.toHaveBeenCalled();
    });

    it('should use S3StorageProvider when it is cloud destination', () => {
      mockedIsCloudUploadDestination.mockReturnValue(true);
      service = new UserService(); // Re-instantiate to pick up new mock
      expect(mockedS3StorageProvider).toHaveBeenCalledTimes(1);
      expect(mockedLocalStorageProvider).not.toHaveBeenCalled();
    });
  });

  describe('updateProfilePicture', () => {
    const mockFile = { originalname: 'test.jpg', buffer: Buffer.from('data') } as Express.Multer.File;
    const newUrl = 'http://example.com/new.jpg';

    it('should throw an error if user is not found', async () => {
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(service.updateProfilePicture(mockUser._id.toString(), mockFile)).rejects.toThrow('Usuário não encontrado.');
    });

    it('should save new picture and update user if no old picture exists', async () => {
      mockStorageProvider.saveFile.mockResolvedValue(newUrl);
      mockUser.profilePictureUrl = undefined; // Ensure no old picture

      const result = await service.updateProfilePicture(mockUser._id.toString(), mockFile);

      expect(mockStorageProvider.deleteFile).not.toHaveBeenCalled();
      expect(mockStorageProvider.saveFile).toHaveBeenCalledWith(mockFile);
      expect(mockUser.profilePictureUrl).toBe(newUrl);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });

    it('should delete old picture, save new, and update user', async () => {
      const oldUrl = 'http://example.com/old.jpg';
      mockUser.profilePictureUrl = oldUrl;
      mockStorageProvider.saveFile.mockResolvedValue(newUrl);

      const result = await service.updateProfilePicture(mockUser._id.toString(), mockFile);

      expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith(oldUrl);
      expect(mockStorageProvider.saveFile).toHaveBeenCalledWith(mockFile);
      expect(mockUser.profilePictureUrl).toBe(newUrl);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('createUser', () => {
    it('should create and save a new user', async () => {
      const userData = { email: 'new@example.com', name: 'New User' };
      const result = await service.createUser(userData as any);

      expect(mockedUserModel).toHaveBeenCalledWith(expect.objectContaining(userData));
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const result = await service.getUserById(mockUser._id.toString());
      expect(mockedUserModel.findById).toHaveBeenCalledWith(mockUser._id.toString());
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockedUserModel.findById.mockResolvedValue(null);
      const result = await service.getUserById(mockUser._id.toString());
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const updateData = { name: 'Updated Name' };

    it('should update user and return updated user', async () => {
      const result = await service.updateUser(mockUser._id.toString(), updateData);
      expect(mockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUser._id.toString(), updateData, { new: true });
      expect(result).toEqual(mockUser);
    });
  });

  describe('approveUser', () => {
    it('should approve user and return updated user', async () => {
      const result = await service.approveUser(mockUser._id.toString());
      expect(mockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUser._id.toString(), { approved: true }, { new: true });
      expect(result).toEqual(mockUser);
    });
  });

  describe('validateUserPassword', () => {
    it('should return false if user not found', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);
      const result = await service.validateUserPassword(mockUser._id.toString(), 'password');
      expect(result).toBe(false);
    });

    it('should return true if password is valid', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      const result = await service.validateUserPassword(mockUser._id.toString(), 'password');
      expect(mockUser.comparePassword).toHaveBeenCalledWith('password');
      expect(result).toBe(true);
    });

    it('should return false if password is invalid', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);
      const result = await service.validateUserPassword(mockUser._id.toString(), 'wrong-password');
      expect(mockUser.comparePassword).toHaveBeenCalledWith('wrong-password');
      expect(result).toBe(false);
    });
  });
});
