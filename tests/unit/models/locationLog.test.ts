
import mongoose from 'mongoose';
import { LocationLogModel } from '../../../src/models/locationLog';
import { UserModel } from '../../../src/models/user';
import { RideModel } from '../../../src/models/ride';
import { ILocationLog, IUser, IRide } from '../../../src/types';
import { LocationLogAction } from '../../../src/types/enums/enums';

describe('LocationLog Model', () => {
  let user: IUser;
  let ride: IRide;

  beforeEach(async () => {
    await LocationLogModel.deleteMany({});
    await RideModel.deleteMany({});
    await UserModel.deleteMany({});
    user = await new UserModel({ name: 'Test User', email: 'user@test.com', matricula: 'USER123', password: 'p' }).save();
    // A ride needs a driver and vehicle, but for this test, we can create a minimal ride document
    // In a real scenario, you'd create valid related documents.
    const driver = await new UserModel({ name: 'Driver', email: 'driver@test.com', matricula: 'DRIVER123', password: 'p' }).save();
    ride = await new RideModel({
        driver: driver._id,
        vehicle: new mongoose.Types.ObjectId(),
        origin: { location: 'A', point: { type: 'Point', coordinates: [0,0] } },
        destination: { location: 'B', point: { type: 'Point', coordinates: [1,1] } },
        departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        availableSeats: 1,
        price: 10
    }).save();
  });

  function createLogData(overrides = {}): Partial<ILocationLog> {
    return {
      ride: ride._id,
      user: user._id,
      action: LocationLogAction.START_RIDE,
      ...overrides,
    };
  }

  describe('Log Creation', () => {
    it('should create a new location log with valid data', async () => {
      const logData = createLogData();
      const log = await new LocationLogModel(logData).save();

      expect(log._id).toBeDefined();
      expect(log.ride).toEqual(ride._id);
      expect(log.user).toEqual(user._id);
      expect(log.action).toBe(LocationLogAction.START_RIDE);
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('should fail if required fields are missing', async () => {
      await expect(new LocationLogModel(createLogData({ ride: undefined })).save()).rejects.toThrow('ride: Path `ride` is required');
      await expect(new LocationLogModel(createLogData({ user: undefined })).save()).rejects.toThrow('user: Path `user` is required');
      await expect(new LocationLogModel(createLogData({ action: undefined })).save()).rejects.toThrow('action: Path `action` is required');
    });

    it('should fail for an invalid action enum value', async () => {
      const logData = createLogData({ action: 'INVALID_ACTION' as any });
      await expect(new LocationLogModel(logData).save()).rejects.toThrow('is not a valid enum value for path `action`');
    });
  });
});
