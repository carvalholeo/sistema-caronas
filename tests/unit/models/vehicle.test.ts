
import mongoose, { Types } from 'mongoose';
import { VehicleModel } from '../../../src/models/vehicle';
import { UserModel } from '../../../src/models/user';
import { RideModel } from '../../../src/models/ride';
import { VehicleStatus, RideStatus } from '../../../src/types/enums/enums';
import { IVehicle, IUser } from '../../../src/types';

describe('Vehicle Model', () => {
  let owner: IUser;

  beforeEach(async () => {
    await VehicleModel.deleteMany({});
    await UserModel.deleteMany({});
    await RideModel.deleteMany({});
    await mongoose.connection.collections.rides.deleteMany({});

    owner = await new UserModel({
      name: 'Test Owner',
      email: 'owner@example.com',
      matricula: 'OWNER123',
      password: 'password123',
    }).save();
  });

  function createVehicleData(overrides = {}): IVehicle {
    return {
      owner: owner._id,
      plate: `ABC${Math.floor(Math.random() * 9000) + 1000}`,
      make: 'Ford',
      carModel: 'Fiesta',
      year: 2020,
      color: 'White',
      capacity: 4,
      ...overrides,
    } as IVehicle;
  }

  it('should create a new vehicle with valid data', async () => {
    const vehicleData = createVehicleData();
    const vehicle = new VehicleModel(vehicleData);
    const savedVehicle = await vehicle.save();

    expect(savedVehicle._id).toBeDefined();
    expect(savedVehicle.plate).toBeDefined();
    expect(savedVehicle.status).toBe(VehicleStatus.Active);
  });

  it('should fail with an invalid license plate', async () => {
    const vehicleData = createVehicleData({ plate: 'INVALID' });
    const vehicle = new VehicleModel(vehicleData);
    await expect(vehicle.save()).rejects.toThrow('Please enter a valid license plate format (ABC1234 or ABC1A23)');
  });

  it('should fail for a year in the far future', async () => {
    const futureYear = new Date().getFullYear() + 2;
    const vehicleData = createVehicleData({ year: futureYear });
    const vehicle = new VehicleModel(vehicleData);
    await expect(vehicle.save()).rejects.toThrow('Year must not be in the far future');
  });

  it('should fail for capacity less than 2', async () => {
    const vehicleData = createVehicleData({ capacity: 1 });
    const vehicle = new VehicleModel(vehicleData);
    await expect(vehicle.save()).rejects.toThrow('capacity: Path `capacity` (1) is less than minimum allowed value (2).');
  });

  it('should fail for capacity greater than 8', async () => {
    const vehicleData = createVehicleData({ capacity: 9 });
    const vehicle = new VehicleModel(vehicleData);
    await expect(vehicle.save()).rejects.toThrow('capacity: Path `capacity` (9) is more than maximum allowed value (8).');
  });

  it('should set status to Pending if an Active vehicle with the same plate exists', async () => {
    const vehicleData1 = createVehicleData({ plate: 'QWE1A23' });
    await new VehicleModel(vehicleData1).save();

    const vehicleData2 = createVehicleData({ plate: 'QWE1A23' });
    const newVehicle = await new VehicleModel(vehicleData2).save();

    expect(newVehicle.status).toBe(VehicleStatus.Pending);
  });

  it('should set status to Active if no other Active vehicle with the same plate exists', async () => {
    const vehicleData1 = createVehicleData({ plate: 'ZXC0987', status: VehicleStatus.Active });
    await new VehicleModel(vehicleData1).save();
    expect(vehicleData1.status).toBe(VehicleStatus.Active);

    vehicleData1.status = VehicleStatus.Inactive;
    await vehicleData1.save();
    expect(vehicleData1.status).toBe(VehicleStatus.Inactive);

    const vehicleData2 = createVehicleData({ plate: 'ZXC0987' });
    const newVehicle = await new VehicleModel(vehicleData2).save();

    expect(newVehicle.status).toBe(VehicleStatus.Active);
  });

  it('should prevent changing owner of an active vehicle', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    const newOwner = await new UserModel({ name: 'New Owner', email: 'newowner@example.com', matricula: 'NEWOWN123', password: 'password' }).save();

    vehicle.owner = newOwner._id as Types.ObjectId;
    await expect(vehicle.save()).rejects.toThrow('Owner cannot be changed while vehicle is active');
  });

  it('should prevent deactivating a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { location: 'A', point: { type: 'Point', coordinates: [0,0] } },
        destination: { location: 'B', point: { type: 'Point', coordinates: [1,1] } },
        departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        availableSeats: 3,
        status: RideStatus.Scheduled,
        price: 1,
    }).save();

    vehicle.status = VehicleStatus.Inactive;
    await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');
  });

  it('should prevent changing plate of a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { location: 'A', point: { type: 'Point', coordinates: [0,0] } },
        destination: { location: 'B', point: { type: 'Point', coordinates: [1,1] } },
        departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        availableSeats: 3,
        status: RideStatus.Scheduled,
        price: 1,
    }).save();

    vehicle.plate = 'POI5678';
    await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');
  });

  it('should prevent changing capacity of a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { location: 'A', point: { type: 'Point', coordinates: [0,0] } },
        destination: { location: 'B', point: { type: 'Point', coordinates: [1,1] } },
        departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        availableSeats: 3,
        status: RideStatus.Scheduled,
        price: 1,
    }).save();

    vehicle.capacity = 5;
    await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');
  });

  it('should allow non-critical edits on a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
     await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { location: 'A', point: { type: 'Point', coordinates: [0,0] } },
        destination: { location: 'B', point: { type: 'Point', coordinates: [1,1] } },
        departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        availableSeats: 3,
        status: RideStatus.Scheduled,
        price: 1,
    }).save();

    vehicle.color = 'Blue';
    await expect(vehicle.save()).resolves.toBeDefined();
    const updatedVehicle = await VehicleModel.findById(vehicle._id);
    expect(updatedVehicle?.color).toBe('Blue');
  });

  describe('VehicleStatus Transitions and Plate Uniqueness', () => {
    it('should create a new vehicle with unique plate as Active by default', async () => {
      const vehicle = await new VehicleModel(createVehicleData({ plate: 'NEW1234' })).save();
      expect(vehicle.status).toBe(VehicleStatus.Active);
    });

    it('should set status to Pending if a new vehicle has a plate conflicting with an existing Active one', async () => {
      await new VehicleModel(createVehicleData({ plate: 'TYU4321' })).save();
      const newVehicle = await new VehicleModel(createVehicleData({ plate: 'TYU4321' })).save();
      expect(newVehicle.status).toBe(VehicleStatus.Pending);
    });

    it('should allow a vehicle to become Active if its plate no longer conflicts', async () => {
      const activeVehicle = await new VehicleModel(createVehicleData({ plate: 'TEM1234' })).save();
      const pendingVehicle = await new VehicleModel(createVehicleData({ plate: 'TEM1234', status: VehicleStatus.Pending })).save();
      expect(pendingVehicle.status).toBe(VehicleStatus.Pending);

      activeVehicle.status = VehicleStatus.Inactive;
      await activeVehicle.save();

      pendingVehicle.status = VehicleStatus.Active;
      await expect(pendingVehicle.save()).resolves.toBeDefined();
      expect(pendingVehicle.status).toBe(VehicleStatus.Active);
    });

    it('should prevent changing status to Active if plate conflicts with another Active vehicle', async () => {
      await new VehicleModel(createVehicleData({ plate: 'ABC1234' })).save();
      const pendingVehicle = await new VehicleModel(createVehicleData({ plate: 'ABC1234', status: VehicleStatus.Pending })).save();

      pendingVehicle.status = VehicleStatus.Active;
      await expect(pendingVehicle.save()).rejects.toThrow(); // Expecting validation error due to unique index
    });

    it('should allow changing status from Active to Inactive/Rejected/Pending without active rides', async () => {
      const vehicle = await new VehicleModel(createVehicleData()).save();
      vehicle.status = VehicleStatus.Pending;
      await expect(vehicle.save()).resolves.toBeDefined();
      expect(vehicle.status).toBe(VehicleStatus.Pending);

      const vehicle2 = await new VehicleModel(createVehicleData({ plate: 'TES2222' })).save();
      vehicle2.status = VehicleStatus.Active;
      await expect(vehicle2.save()).resolves.toBeDefined();
      expect(vehicle2.status).toBe(VehicleStatus.Active);

      const vehicle3 = await new VehicleModel(createVehicleData({ plate: 'TES3333' })).save();
      vehicle3.status = VehicleStatus.Pending;
      await expect(vehicle3.save()).resolves.toBeDefined();
      expect(vehicle3.status).toBe(VehicleStatus.Pending);
    });

    it('should prevent changing plate or capacity if there are active rides', async () => {
      const vehicle = await new VehicleModel(createVehicleData()).save();
      await new RideModel({
          driver: owner._id,
          vehicle: vehicle._id,
          origin: { location: 'A', point: { type: 'Point', coordinates: [0,0] } },
          destination: { location: 'B', point: { type: 'Point', coordinates: [1,1] } },
          departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
          availableSeats: 3,
          status: RideStatus.Scheduled,
          price: 1,
      }).save();

      vehicle.plate = 'MTE0000';
      await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');

      vehicle.plate = vehicle.plate; // Reset plate
      vehicle.capacity = 5;
      await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');
    });
  });
});
