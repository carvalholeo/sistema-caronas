import { IUser } from 'types';
import { UserModel } from 'models/user';

import { IStorageProvider } from 'providers/storage/IStorageProvider';
import { LocalStorageProvider } from 'providers/storage/LocalStorageProvider';
import { isCloudUploadDestination } from 'config/uploadAndMulter';
import { S3StorageProvider } from 'providers/storage/S3StorageProvider';

export class UserService {
    private storageProvider: IStorageProvider;

    constructor() {
        // Aqui você pode facilmente trocar para um S3Provider, etc.
        if (isCloudUploadDestination) {
            this.storageProvider = new S3StorageProvider();
        } else {
            this.storageProvider = new LocalStorageProvider();
        }
    }

    /**
   * Atualiza a foto de perfil de um usuário.
   * @param userId - O ID do usuário.
   * @param file - O arquivo da nova foto de perfil.
   * @returns O usuário atualizado com a nova URL da foto.
   */
    public async updateProfilePicture(userId: string, file: Express.Multer.File) {
        if (!file || file === null) {
            throw new Error('Invalid file');
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado.');
        }

        // Se o usuário já tiver uma foto, deleta a antiga
        if (user.profilePictureUrl) {
            await this.storageProvider.deleteFile(user.profilePictureUrl);
        }

        // Salva o novo arquivo e obtém a URL
        const newPictureUrl = await this.storageProvider.saveFile(file);

        // Atualiza o perfil do usuário com a nova URL
        user.profilePictureUrl = newPictureUrl;
        await user.save();

        return user;
    }

    async createUser(userData: IUser): Promise<IUser> {
        const user = new UserModel({ ...userData });
        return await user.save();
    }

    async getUserById(userId: string): Promise<IUser | null> {
        return await UserModel.findById(userId);
    }

    async updateUser(userId: string, updateData: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(userId, updateData, { new: true });
    }

    async approveUser(userId: string): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(userId, { approved: true }, { new: true });
    }

    async validateUserPassword(userId: string, password: string): Promise<boolean> {
        const user = await this.getUserById(userId);
        if (!user) return false;
        return await user.comparePassword(password);
    }
}