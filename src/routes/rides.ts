import { Router } from 'express';
import { rideController } from '../controllers/rideController';
import { rideValidator, recurrentRideValidator, manageSeatValidator } from '../middlewares/validators/rides';
import { authMiddleware } from '../middlewares/auth';

const rideRouter = Router();

rideRouter.use(authMiddleware);

rideRouter.post('/', rideValidator, rideController.create);
rideRouter.post('/recurrent', recurrentRideValidator, rideController.createRecurrent);
rideRouter.get('/search', rideController.search);
rideRouter.get('/driver', rideController.getMyRidesAsDriver);
rideRouter.get('/passenger', rideController.getMyRidesAsPassenger);
rideRouter.get('/:id', rideController.getDetails);
rideRouter.put('/:id', rideValidator, rideController.update);
rideRouter.post('/:id/request', rideController.requestSeat);
rideRouter.post('/:id/manage', manageSeatValidator, rideController.manageSeatRequest);
rideRouter.delete('/:id', rideController.cancelByDriver);
rideRouter.delete('/:id/seat', rideController.cancelByPassenger);

export default rideRouter;
