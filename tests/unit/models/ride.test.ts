
import mongoose from 'mongoose';
import { RideModel } from '../../../src/models/ride';
import { UserModel } from '../../../src/models/user';
import { VehicleModel } from '../../../src/models/vehicle';
import { RideStatus, VehicleStatus, PassengerStatus } from '../../../src/types/enums/enums';
import { IRide, IUser, IVehicle } from '../../../src/types';

describe('Ride Model', () => {
  let driver: IUser;
  let vehicle: IVehicle;

  beforeEach(async () => {
    await RideModel.deleteMany({});
    await VehicleModel.deleteMany({});
    await UserModel.deleteMany({});

    driver = await new UserModel({
      name: 'Test Driver',
      email: 'driver@example.com',
      matricula: 'DRIVER123',
      password: 'password123',
    }).save();

    vehicle = await new VehicleModel({
      owner: driver._id,
      plate: 'RIDE123',
      make: 'Honda',
      carModel: 'Civic',
      year: 2022,
      color: 'Black',
      capacity: 4,
      status: VehicleStatus.Active,
    }).save();
  });

  function createRideData(overrides = {}): Partial<IRide> {
    const departureTime = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
    return {
      driver: driver!,
      vehicle: vehicle!,
      origin: { location: 'Origin', point: { type: 'Point', coordinates: [-46.6333, -23.5505] } },
      destination: { location: 'Destination', point: { type: 'Point', coordinates: [-46.6388, -23.5555] } },
      departureTime,
      availableSeats: 3,
      price: 50,
      ...overrides,
    };
  }

  describe('Ride Creation', () => {
    it('should create a new ride with valid data', async () => {
      const rideData = createRideData();
      const ride = new RideModel(rideData);
      const savedRide = await ride.save();

      expect(savedRide._id).toBeDefined();
      expect(savedRide.status).toBe(RideStatus.Scheduled);
      expect(savedRide.driver).toEqual(driver._id);
    });

    it('should fail if departure time is less than 2 hours in the future', async () => {
      const departureTime = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now
      const rideData = createRideData({ departureTime });
      const ride = new RideModel(rideData);
      await expect(ride.save()).rejects.toThrow('Departure time must be at least 2 hours in the future');
    });

    it('should fail with invalid coordinates', async () => {
        const rideData = createRideData({ origin: { location: 'Invalid', point: { type: 'Point', coordinates: [200, 200] } } });
        const ride = new RideModel(rideData);
        await expect(ride.save()).rejects.toThrow('Coordinates must be [longitude, latitude] with valid ranges');
    });

    it('should fail if the vehicle is not active', async () => {
        await VehicleModel.findByIdAndUpdate(vehicle._id, { status: VehicleStatus.Inactive });
        const rideData = createRideData();
        const ride = new RideModel(rideData);
        await expect(ride.save()).rejects.toThrow('Vehicle must be active and approved to create rides');
    });

    it('should fail if the driver does not own the vehicle', async () => {
        const otherDriver = await new UserModel({ name: 'Other Driver', email: 'other@test.com', matricula: 'OTHER123', password: 'p' }).save();
        const rideData = createRideData({ driver: otherDriver._id });
        const ride = new RideModel(rideData);
        await expect(ride.save()).rejects.toThrow('Driver must own the vehicle');
    });

    it('should fail if driver has another ride within one hour', async () => {
        const rideData1 = createRideData();
        await new RideModel(rideData1).save();

        const conflictingDeparture = new Date(rideData1.departureTime!.getTime() + 30 * 60 * 1000); // 30 mins later
        const rideData2 = createRideData({ departureTime: conflictingDeparture });
        const ride2 = new RideModel(rideData2);

        await expect(ride2.save()).rejects.toThrow('Driver already has a scheduled ride within one hour of this departure time.');
    });

    it('should fail if driver has more than 4 rides on the same day', async () => {
        const departure = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const rideData = (h: number) => createRideData({ departureTime: new Date(departure.getTime() + h * 61 * 60 * 1000) });

        await new RideModel(rideData(2)).save();
        await new RideModel(rideData(4)).save();
        await new RideModel(rideData(6)).save();
        await new RideModel(rideData(8)).save();

        const ride5 = new RideModel(rideData(10));
        await expect(ride5.save()).rejects.toThrow('A driver cannot have more than 4 rides on the same day');
    });
  });

  describe('Ride Update Logic', () => {
    it('should not allow editing with pending passengers', async () => {
        const ride = await new RideModel(createRideData()).save();
        ride.passengers.push({ user: new mongoose.Types.ObjectId() } as any);
        await ride.save();

        ride.price = 100;
        await expect(ride.save()).rejects.toThrow('Ride cannot be edited while there are pending or approved passengers');
    });

    it('should not allow editing within 1 hour of departure', async () => {
        const departureTime = new Date(Date.now() + 90 * 60 * 1000); // 1.5 hours from now
        const ride = await new RideModel(createRideData({ departureTime })).save();

        // Fast-forward time in test environment would be ideal, here we simulate by checking the validation
        const now = new Date(departureTime.getTime() - 50 * 60 * 1000); // 50 mins before departure
        Object.defineProperty(global, 'Date', { value: jest.fn(() => now), writable: true });

        ride.price = 100;
        await expect(ride.save()).rejects.toThrow('Ride cannot be edited within 1 hour before departureTime');
        
        Object.defineProperty(global, 'Date', { value: Date, writable: true }); // Restore Date
    });

    it('should allow cancellation with pending passengers', async () => {
        const ride = await new RideModel(createRideData()).save();
        ride.passengers.push({ user: new mongoose.Types.ObjectId() } as any);
        await ride.save();

        ride.status = RideStatus.Cancelled;
        ride.cancelReason = 'Test reason';
        await expect(ride.save()).resolves.toBeDefined();
        expect(ride.status).toBe(RideStatus.Cancelled);
    });
  });

  describe('Passenger Management', () => {
    it('should add a passenger with pending status', async () => {
        const ride = await new RideModel(createRideData()).save();
        const passengerId = new mongoose.Types.ObjectId();
        ride.passengers.push({ user: passengerId } as any);
        await ride.save();

        const updatedRide = await RideModel.findById(ride._id);
        expect(updatedRide?.passengers).toHaveLength(1);
        expect(updatedRide?.passengers[0].status).toBe(PassengerStatus.Pending);
    });

    it('should not allow more approved passengers than available seats', async () => {
        const ride = await new RideModel(createRideData({ availableSeats: 1 })).save();
        const passenger1 = new mongoose.Types.ObjectId();
        const passenger2 = new mongoose.Types.ObjectId();

        ride.passengers.push({ user: passenger1, status: PassengerStatus.Approved } as any);
        ride.passengers.push({ user: passenger2, status: PassengerStatus.Approved } as any);

        await expect(ride.save()).rejects.toThrow('Approved passengers (2) exceed available seats (1)');
    });

    it('should not allow reducing available seats below approved passengers', async () => {
        const ride = await new RideModel(createRideData({ availableSeats: 2 })).save();
        ride.passengers.push({ user: new mongoose.Types.ObjectId(), status: PassengerStatus.Approved } as any);
        await ride.save();

        ride.availableSeats = 0;
        await expect(ride.save()).rejects.toThrow('Cannot reduce availableSeats below current approved passengers (1)');
    });
  });
});
