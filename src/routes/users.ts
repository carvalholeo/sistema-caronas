import { Router } from 'express';
import {
    getUserProfile,
    updateUserProfile,
    approveUserRegistration
} from '../controllers/userController';
import { authMiddleware } from '../middlewares/auth';
import { userUpdateValidator } from 'middlewares/validators/users';

const router = Router();

router.use(authMiddleware);

// Route to get user profile
router.get('/:id', getUserProfile);

// Route to update user profile
router.put('/:id', userUpdateValidator, updateUserProfile);

// Route to approve user registration
router.post('/:id/approve', approveUserRegistration);

export default router;