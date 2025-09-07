import { Router } from 'express';
import { vehicleController } from 'controllers/vehicleController';
import { vehicleValidator } from 'middlewares/validators/vehicle';
import { authMiddleware } from 'middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';

const vehicleRouter = Router();

vehicleRouter.use(authMiddleware);
vehicleRouter.use(requestValidator);

vehicleRouter.post('/', vehicleValidator, requestValidator, vehicleController.create);
vehicleRouter.get('/', vehicleController.getMyVehicles);

export default vehicleRouter;
