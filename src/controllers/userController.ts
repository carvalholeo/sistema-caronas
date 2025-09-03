import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { IUser } from 'types';

const userService = new UserService();

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