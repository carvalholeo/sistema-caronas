import { Router } from 'express';
import { vehicleController } from '../controllers/vehicleController';
import { vehicleValidator } from '../middlewares/validators/vehicle';
import { authMiddleware } from '../middlewares/auth';

const vehicleRouter = Router();

vehicleRouter.use(authMiddleware);

vehicleRouter.post('/', vehicleValidator, vehicleController.create);
vehicleRouter.get('/', vehicleController.getMyVehicles);

export default vehicleRouter;
