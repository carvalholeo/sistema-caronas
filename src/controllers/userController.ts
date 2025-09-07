import { Request, Response } from 'express';
import { UserService } from 'services/userService';
import { IUser } from 'types';

const userService = new UserService();

/**
   * Lida com o upload e atualização da foto de perfil.
   */
export const updateProfilePicture = async(req: Request, res: Response): Promise<Response> => {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    try {
      const user = req.user!;
      const updatedUser = await userService.updateProfilePicture(user._id!.toString(), req.file);
      return res.status(200).json({
        message: 'Foto de perfil atualizada com sucesso.',
        profilePictureUrl: updatedUser.profilePictureUrl,
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao atualizar a foto de perfil.', error: error.message });
    }
  }

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;
        const user = await userService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;
        const updatedData: Partial<IUser> = req.body;
        const updatedUser = await userService.updateUser(userId, updatedData);
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const approveUserRegistration = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;
        const approvedUser = await userService.approveUser(userId);
        if (!approvedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(approvedUser);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};