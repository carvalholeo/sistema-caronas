
import mongoose from 'mongoose';
import { VehicleModel } from '../../../src/models/vehicle';
import { UserModel } from '../../../src/models/user';
import { RideModel } from '../../../src/models/ride';
import { VehicleStatus, RideStatus } from '../../../src/types/enums/enums';
import { IVehicle, IUser } from '../../../src/types';

describe('Vehicle Model', () => {
  let owner: IUser;

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/vehicle-model-test', { dbName: 'vehicle-model-test' } as any);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await VehicleModel.deleteMany({});
    await UserModel.deleteMany({});
    await RideModel.deleteMany({});

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
      plate: 'ABC1234',
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
    expect(savedVehicle.plate).toBe('ABC1234');
    expect(savedVehicle.status).toBe(VehicleStatus.Active);
  });

  it('should fail with an invalid license plate', async () => {
    const vehicleData = createVehicleData({ plate: 'INVALID' });
    const vehicle = new VehicleModel(vehicleData);
    await expect(vehicle.save()).rejects.toThrow('Please enter a valid license plate format');
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
    await expect(vehicle.save()).rejects.toThrow('Validation failed: capacity: 1 is less than the minimum allowed value (2).');
  });

  it('should set status to Pending if an Active vehicle with the same plate exists', async () => {
    const vehicleData1 = createVehicleData({ plate: 'SAM1234' });
    await new VehicleModel(vehicleData1).save();

    const vehicleData2 = createVehicleData({ plate: 'SAM1234' });
    const newVehicle = await new VehicleModel(vehicleData2).save();

    expect(newVehicle.status).toBe(VehicleStatus.Pending);
  });

  it('should set status to Active if no other Active vehicle with the same plate exists', async () => {
    const vehicleData1 = createVehicleData({ plate: 'SAM1234', status: VehicleStatus.Inactive });
    await new VehicleModel(vehicleData1).save();

    const vehicleData2 = createVehicleData({ plate: 'SAM1234' });
    const newVehicle = await new VehicleModel(vehicleData2).save();

    expect(newVehicle.status).toBe(VehicleStatus.Active);
  });

  it('should prevent changing owner of an active vehicle', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    const newOwner = await new UserModel({ name: 'New Owner', email: 'newowner@example.com', matricula: 'NEWOWN123', password: 'password' }).save();

    vehicle.owner = newOwner._id;
    await expect(vehicle.save()).rejects.toThrow('Owner cannot be changed while vehicle is active');
  });

  it('should prevent deactivating a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { coordinates: [-46.6333, -23.5505] },
        destination: { coordinates: [-46.6333, -23.5505] },
        departureTime: new Date(),
        availableSeats: 3,
        status: RideStatus.Scheduled,
    }).save();

    vehicle.status = VehicleStatus.Inactive;
    await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');
  });

  it('should prevent changing plate of a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
    await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { coordinates: [-46.6333, -23.5505] },
        destination: { coordinates: [-46.6333, -23.5505] },
        departureTime: new Date(),
        availableSeats: 3,
        status: RideStatus.InProgress,
    }).save();

    vehicle.plate = 'XYZ9876';
    await expect(vehicle.save()).rejects.toThrow('Vehicle cannot be deactivated or have plate/capacity edited while there are scheduled or in-progress rides');
  });

  it('should allow non-critical edits on a vehicle with active rides', async () => {
    const vehicle = await new VehicleModel(createVehicleData()).save();
     await new RideModel({
        driver: owner._id,
        vehicle: vehicle._id,
        origin: { coordinates: [-46.6333, -23.5505] },
        destination: { coordinates: [-46.6333, -23.5505] },
        departureTime: new Date(),
        availableSeats: 3,
        status: RideStatus.Scheduled,
    }).save();

    vehicle.color = 'Blue';
    await expect(vehicle.save()).resolves.toBeDefined();
    const updatedVehicle = await VehicleModel.findById(vehicle._id);
    expect(updatedVehicle?.color).toBe('Blue');
  });
});
