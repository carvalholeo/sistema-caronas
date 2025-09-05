import { Router } from 'express';
import { rideController } from '../controllers/rideController';
import { rideValidator, recurrentRideValidator, manageSeatValidator } from '../middlewares/validators/rides';
import { authMiddleware } from '../middlewares/auth';
import { requestValidator } from 'middlewares/requestValidator';

const rideRouter = Router();

rideRouter.use(authMiddleware);
rideRouter.use(requestValidator);

rideRouter.post('/', rideValidator, requestValidator, rideController.create);
rideRouter.post('/recurrent', recurrentRideValidator, requestValidator, rideController.createRecurrent);
rideRouter.get('/search', requestValidator, rideController.search);
rideRouter.get('/driver', requestValidator, rideController.getMyRidesAsDriver);
rideRouter.get('/passenger', requestValidator, rideController.getMyRidesAsPassenger);
rideRouter.get('/:id', requestValidator, rideController.getDetails);
rideRouter.put('/:id', rideValidator, requestValidator, rideController.update);
rideRouter.post('/:id/request', requestValidator, rideController.requestSeat);
rideRouter.post('/:id/manage', manageSeatValidator, requestValidator, rideController.manageSeatRequest);
rideRouter.delete('/:id', requestValidator, rideController.cancelByDriver);
rideRouter.delete('/:id/seat', requestValidator, rideController.cancelByPassenger);

export default rideRouter;
