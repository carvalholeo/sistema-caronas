import { IUser, UserModel as User }  from '../models/user';

export class UserService {
    async createUser(userData: IUser): Promise<IUser> {
        const user = new User({ ...userData });
        return await user.save();
    }

    async getUserById(userId: string): Promise<IUser | null> {
        return await User.findById(userId);
    }

    async updateUser(userId: string, updateData: Partial<IUser>): Promise<IUser | null> {
        return await User.findByIdAndUpdate(userId, updateData, { new: true });
    }

    async approveUser(userId: string): Promise<IUser | null> {
        return await User.findByIdAndUpdate(userId, { approved: true }, { new: true });
    }

    async validateUserPassword(userId: string, password: string): Promise<boolean> {
        const user = await this.getUserById(userId);
        if (!user) return false;
        return await user.comparePassword(password);
    }
}