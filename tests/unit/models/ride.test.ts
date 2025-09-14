import mongoose from 'mongoose';
import { PassengerModel, PointModel, RideModel } from '../../../src/models/ride';
import { UserModel } from '../../../src/models/user';
import { VehicleModel } from '../../../src/models/vehicle';
import { RideStatus, VehicleStatus, PassengerStatus } from '../../../src/types/enums/enums';
import { IRide, IRidePassenger, IUser, IVehicle } from '../../../src/types';
import { request } from 'http';

describe('Ride Model', () => {
  let driver: IUser;
  let vehicle: IVehicle;
  let passenger: IRidePassenger;
  let otherPassenger: IRidePassenger;

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

    const userPassenger = await new UserModel({
      name: 'Test Passenger',
      email: 'passenger@example.com',
      matricula: 'PASSENGER123',
      password: 'password123',
    }).save();

    passenger = await new PassengerModel({
      user: userPassenger,
      status: PassengerStatus.Pending,
      requestedAt: new Date(),
    }).save();

    otherPassenger = await new PassengerModel({
      user: userPassenger,
      status: PassengerStatus.Pending,
      requestedAt: new Date(),
    }).save();

    vehicle = await new VehicleModel({
      owner: driver._id,
      plate: 'RID1234',
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
    const origin = new PointModel({type: 'Point', coordinates: [-46.6333, -23.5505]});
    const destination = new PointModel({type: 'Point', coordinates: [-46.6388, -23.5555]});
    return {
      driver: driver!,
      vehicle: vehicle!,
      origin: { location: 'Origin', point: origin },
      destination: { location: 'Destination', point: destination },
      departureTime,
      availableSeats: 3,
      price: 50,
      status: RideStatus.Scheduled,
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

    it('should set canceledAt and require cancelReason when status is Cancelled', async () => {
      const ride = await new RideModel(createRideData()).save();
      ride.status = RideStatus.Cancelled;
      await expect(ride.save()).rejects.toThrow('Cancel reason is required when cancelling a ride');

      ride.cancelReason = 'Driver cancelled';
      await expect(ride.save()).resolves.toBeDefined();
      expect(ride.canceledAt).toBeInstanceOf(Date);
    });

    it('should clear canceledAt if status changes from Cancelled (if possible)', async () => {
      // This scenario is unlikely in real app due to terminal state, but good for robustness
      const ride = await new RideModel(createRideData()).save();
      ride.status = RideStatus.Cancelled;
      ride.cancelReason = 'Driver cancelled';
      await ride.save();
      expect(ride.canceledAt).toBeInstanceOf(Date);

      // Simulate changing status back (will fail validation, but tests the pre-save logic)
      ride.status = RideStatus.Scheduled;
      ride.cancelReason = undefined; // Clear reason as well
      await expect(ride.save()).rejects.toThrow(); // Expecting invalid transition error

      // Manually set status and check if canceledAt is cleared by pre-save hook
      const ride2 = await new RideModel(createRideData()).save();
      ride2.canceledAt = new Date(); // Set it manually
      ride2.status = RideStatus.Scheduled; // No change, but triggers save hook
      await ride2.save();
      expect(ride2.canceledAt).toBeUndefined();
    });

    it('should not allow canceledAt to be earlier than createdAt', async () => {
      const ride = await new RideModel(createRideData()).save();
      ride.status = RideStatus.Cancelled;
      ride.cancelReason = 'test';
      ride.canceledAt = new Date(ride.createdAt.getTime() - 1000);
      await expect(ride.save()).rejects.toThrow('canceledAt cannot be earlier than createdAt');
    });
  });

  describe('RideStatus Transitions', () => {
    const allowedTransitionsRide: Record<RideStatus, RideStatus[]> = {
      [RideStatus.Scheduled]: [RideStatus.InProgress, RideStatus.Cancelled],
      [RideStatus.InProgress]: [RideStatus.Completed, RideStatus.Cancelled],
      [RideStatus.Completed]: [],
      [RideStatus.Cancelled]: [],
    };

    it('should only allow Scheduled as the initial status', async () => {
      await expect(
        new RideModel(createRideData({ status: RideStatus.InProgress })).save()
      ).rejects.toThrow(/Invalid initial status/i);
    });

    for (const fromStatus of Object.values(RideStatus)) {
      const allowed = allowedTransitionsRide[fromStatus] || [];
      for (const toStatus of allowed) {
        it(`should allow transition from ${fromStatus} to ${toStatus}`, async () => {
          const ride = await new RideModel(createRideData()).save();
          ride.status = fromStatus;
          await ride.save();

          ride.status = toStatus;
          await expect(ride.save()).resolves.toBeDefined();
        });
      }

      const disallowed = Object.values(RideStatus).filter(s => !allowed.includes(s) && s !== fromStatus);
      for (const toStatus of disallowed) {
        it(`should block transition from ${fromStatus} to ${toStatus}`, async () => {
          const ride = await new RideModel(createRideData()).save();
          ride.status = fromStatus;
          await ride.save();

          ride.status = toStatus;
          await expect(ride.save()).rejects.toThrow(/Invalid status transition/i);
        });
      }
    }

    it('should cancel pending/approved passengers when ride status changes from Scheduled', async () => {
      const ride = await new RideModel(createRideData()).save();

      ride.passengers.push(passenger);
      ride.passengers.push(otherPassenger);
      await ride.save();

      passenger.status = PassengerStatus.Approved;
      await passenger.save();

      await ride.save();

      ride.status = RideStatus.InProgress;
      await ride.save();

      const updatedRide = await RideModel.findById(ride._id);
      const passengerData = await PassengerModel.findOne({user: updatedRide!.passengers[0].user});
      const otherPassengerData = await PassengerModel.findOne({user: updatedRide!.passengers[1].user});

      expect(passengerData?.status).toBe(PassengerStatus.Cancelled);
      expect(otherPassengerData?.status).toBe(PassengerStatus.Rejected);
    });
  });

  describe('Passenger Management', () => {
    it('should add a passenger with pending status', async () => {
        const ride = await new RideModel(createRideData()).save();
        ride.passengers.push(passenger);
        await ride.save();

        const updatedRide = await RideModel.findById(ride._id);
        const passengerData = await PassengerModel.findOne({user: updatedRide!.passengers[0].user});
        expect(updatedRide?.passengers).toHaveLength(1);
        expect(passengerData?.status).toBe(PassengerStatus.Pending);
    });

    it('should not allow more approved passengers than available seats', async () => {
        const ride = await new RideModel(createRideData({ availableSeats: 1 })).save();
        ride.passengers.push(passenger);
        passenger.status = PassengerStatus.Approved;
        await ride.save();
        await passenger.save();
        await ride.save();

        ride.passengers.push(otherPassenger);
        otherPassenger.status = PassengerStatus.Approved;
        await ride.save();
        await otherPassenger.save();

        await expect(ride.save()).rejects.toThrow('Approved passengers (2) exceed available seats (1)');
    });

    it('should not allow reducing available seats below approved passengers', async () => {
        const ride = await new RideModel(createRideData({ availableSeats: 2 })).save();
        ride.passengers.push(passenger);
        await ride.save();

        ride.availableSeats = 0;
        await expect(ride.save()).rejects.toThrow(/Ride cannot be edited/i);
    });
  });

  describe('PassengerStatus Transitions', () => {
    const allowedTransitionsPassengers: Record<PassengerStatus, PassengerStatus[]> = {
      [PassengerStatus.Pending]: [PassengerStatus.Approved, PassengerStatus.Rejected, PassengerStatus.Cancelled],
      [PassengerStatus.Approved]: [PassengerStatus.Cancelled],
      [PassengerStatus.Rejected]: [],
      [PassengerStatus.Cancelled]: [],
    };

    it('should only allow Pending as the initial status', async () => {
      const ride = await new RideModel(createRideData()).save();
      passenger.status = PassengerStatus.Approved;
      await passenger.save();

      ride.passengers.push(passenger);
      await expect(ride.save()).rejects.toThrow(/Invalid initial status/i);
    });

    for (const fromStatus of Object.values(PassengerStatus)) {
      const allowed = allowedTransitionsPassengers[fromStatus] || [];
      for (const toStatus of allowed) {
        it(`should allow transition from ${fromStatus} to ${toStatus}`, async () => {
          const ride = await new RideModel(createRideData()).save();
          ride.passengers.push(passenger);
          await ride.save();

          const updatedRide = await RideModel.findById(ride._id);
          const passengerData = await PassengerModel.findOne({user: updatedRide!.passengers[0].user});
          passengerData!.status = toStatus;
          await expect(passengerData!.save()).resolves.toBeDefined();
        });
      }

      const disallowed = Object.values(PassengerStatus).filter(s => !allowed.includes(s) && s !== fromStatus);
      for (const toStatus of disallowed) {
        it(`should block transition from ${fromStatus} to ${toStatus}`, async () => {
          const ride = await new RideModel(createRideData()).save();
          ride.passengers.push(passenger);
          await ride.save();

          const updatedRide = await RideModel.findById(ride._id);
          const passengerData = await PassengerModel.findOne({user: updatedRide!.passengers[0].user});
          passengerData!.status = toStatus;
          await expect(passengerData!.save()).rejects.toThrow(`Invalid status transition: ${fromStatus} -> ${toStatus}`);
        });
      }
    }

    it('should prevent requestedAt from being modified after creation', async () => {
      const ride = await new RideModel(createRideData()).save();
      ride.passengers.push(passenger);
      await ride.save();

      const updatedRide = await RideModel.findById(ride._id);
      const passengerData = await PassengerModel.findOne({user: updatedRide!.passengers[0].user});
      const oldRequestedAt = passengerData!.requestedAt;
      passengerData!.requestedAt = new Date(oldRequestedAt!.getTime() - 30000);
      await expect(passengerData!.save()).rejects.toThrow('requestedAt cannot be modified after creation');
    });

    it('should set managedAt and validate temporal consistency when status changes to Approved/Rejected/Cancelled', async () => {
      const ride = await new RideModel(createRideData()).save();
      ride.passengers.push(passenger);
      await ride.save();

      const updatedRide = await RideModel.findById(ride._id);
      const passengerData = await PassengerModel.findOne({user: updatedRide!.passengers[0].user});
      passengerData!.status = PassengerStatus.Approved;
      await passengerData!.save();
      expect(passengerData!.managedAt).toBeInstanceOf(Date);
      expect(passengerData!.managedAt?.getTime()).toBeGreaterThanOrEqual(passengerData!.requestedAt?.getTime());

      // Test temporal inconsistency
      passengerData!.status = PassengerStatus.Cancelled;
      passengerData!.managedAt = new Date(passengerData!.requestedAt.getTime() - 30000);
      await expect(passengerData!.save()).rejects.toThrow('managedAt cannot be earlier than requestedAt');
    });
  });
});
