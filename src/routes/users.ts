import { Router } from 'express';
import {
    getUserProfile,
    updateUserProfile,
    approveUserRegistration
} from '../controllers/userController';
import { authMiddleware } from '../middlewares/auth';
import { validateUserUpdate } from '../middlewares/validation';
import requirePermission from '../middlewares/rbac';
import { UserRole } from 'models/user';

const router = Router();

// Route to get user profile
router.get('/:id', authMiddleware, getUserProfile);

// Route to update user profile
router.put('/:id', authMiddleware, validateUserUpdate, updateUserProfile);

// Route to approve user registration
router.post('/:id/approve', authMiddleware, requirePermission([UserRole.Admin]), approveUserRegistration);

export default router;