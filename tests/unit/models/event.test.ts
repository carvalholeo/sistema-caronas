// test/events.test.ts
import mongoose from 'mongoose';
import {
  EventModel,
  NotificationEventModel,
  RideViewEventModel,
  SearchEventModel,
} from '../../../src/models/event';

describe('Unified Event discriminators', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/events-disc', { dbName: 'events-disc' } as any);
    await EventModel.deleteMany({});
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('stores all subtypes in the same collection', async () => {
    await NotificationEventModel.create({
      kind: 'notification',
      subscription: new mongoose.Types.ObjectId(),
      category: 'ride_updates',
      statusHistory: [{ status: 'queued' }],
      isAggregated: false,
      isCritical: false,
    });

    await RideViewEventModel.create({
      kind: 'ride_view',
      user: new mongoose.Types.ObjectId(),
      ride: new mongoose.Types.ObjectId()
    });

    await SearchEventModel.create({
      kind: 'search',
      user: new mongoose.Types.ObjectId(),
      durationMs: 120,
      resultsCount: 5
    });

    const count = await EventModel.countDocuments();
    expect(count).toBe(3);

    const rideViews = await EventModel.find({ kind: 'ride_view' });
    expect(rideViews.length).toBe(1);
  });

  it('validates subtype-specific fields', async () => {
    // durationMs negativo deve falhar
    await expect(
      SearchEventModel.create({
        kind: 'search',
        user: new mongoose.Types.ObjectId(),
        durationMs: -1,
        resultsCount: 0,
      })
    ).rejects.toThrow();
  });
});
