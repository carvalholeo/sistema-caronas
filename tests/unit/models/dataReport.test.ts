
import mongoose from 'mongoose';
import { DataReportModel } from '../../../src/models/dataReport';
import { UserModel } from '../../../src/models/user';
import { IDataReport, IUser } from '../../../src/types';
import { v4 as uuidv4 } from 'uuid';

describe('DataReport Model', () => {
  let user: IUser;
  let adminUser: IUser;

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/datareport-test', { dbName: 'datareport-test' } as any);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await DataReportModel.deleteMany({});
    await UserModel.deleteMany({});
    user = await new UserModel({ name: 'Test User', email: 'user@test.com', matricula: 'USER123', password: 'p' }).save();
    adminUser = await new UserModel({ name: 'Admin User', email: 'admin@test.com', matricula: 'ADMIN123', password: 'p', roles: ['admin'] }).save();
  });

  function createReportData(overrides = {}): Partial<IDataReport> {
    return {
      user: user._id,
      adminUser: adminUser._id,
      hash: uuidv4(),
      includedDataPoints: ['profile', 'rides'],
      ...overrides,
    };
  }

  describe('Report Creation', () => {
    it('should create a new data report with valid data', async () => {
      const reportData = createReportData();
      const report = await new DataReportModel(reportData).save();

      expect(report._id).toBeDefined();
      expect(report.user).toEqual(user._id);
      expect(report.adminUser).toEqual(adminUser._id);
      expect(report.includedDataPoints).toEqual(['profile', 'rides']);
      expect(report.createdAt).toBeInstanceOf(Date);
      expect(report.updatedAt).toBeUndefined();
    });

    it('should fail if required fields are missing', async () => {
      await expect(new DataReportModel(createReportData({ user: undefined })).save()).rejects.toThrow('user: Path `user` is required');
      await expect(new DataReportModel(createReportData({ adminUser: undefined })).save()).rejects.toThrow('adminUser: Path `adminUser` is required');
      await expect(new DataReportModel(createReportData({ hash: undefined })).save()).rejects.toThrow('hash: Path `hash` is required');
    });

    it('should enforce unique hash constraint', async () => {
      const hash = uuidv4();
      await new DataReportModel(createReportData({ hash })).save();
      await expect(new DataReportModel(createReportData({ hash })).save()).rejects.toThrow('E11000 duplicate key error');
    });
  });
});
