import { Router } from 'express';
import { chatController } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';

const chatRouter = Router();

chatRouter.use(authMiddleware);
chatRouter.use(requestValidator);

chatRouter.get('/:rideId/', chatController.getHistory);
chatRouter.get('/:rideId/export', chatController.exportHistory);

export default chatRouter;
