import { Router } from 'express';
import {
    getUserProfile,
    updateUserProfile,
    approveUserRegistration,
    updateProfilePicture
} from 'controllers/userController';
import { authMiddleware } from 'middlewares/auth';
import { userUpdateValidator } from 'middlewares/validators/users';
import { requestValidator } from 'middlewares/requestValidator';
import { upload } from 'config/uploadAndMulter';

const router = Router();

router.use(authMiddleware);
router.use(requestValidator);

// Route to get user profile
router.get('/:id', requestValidator, getUserProfile);

// Route to update user profile
router.put('/:id', userUpdateValidator, requestValidator, updateUserProfile);

router.patch(
  '/profile/picture',
  authMiddleware,
  upload.single('profilePicture'), // 'profilePicture' é o nome do campo no formulário
  requestValidator,
  updateProfilePicture
);

// Route to approve user registration
router.post('/:id/approve', requestValidator, approveUserRegistration);

export default router;