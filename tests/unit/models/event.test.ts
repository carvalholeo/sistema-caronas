// test/events.test.ts
import mongoose from 'mongoose';
import {
  EventModel,
  NotificationEventModel,
  RideViewEventModel,
  SearchEventModel,
} from '../../../src/models/event';
import { NotificationScope } from '../../../src/types/enums/enums';

describe('Unified Event discriminators', () => {

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

  describe('NotificationEventModel', () => {
    it('should require either subscription or user', async () => {
      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          category: 'ride_updates',
          statusHistory: [{ status: 'queued' }],
        })
      ).rejects.toThrow('Either subscription or user must be set for a notification');
    });

    it('should require user for privacy scope notifications', async () => {
      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          scope: NotificationScope.Privacy,
          subscription: new mongoose.Types.ObjectId(),
          category: 'ride_updates',
          statusHistory: [{ status: 'queued' }],
        })
      ).rejects.toThrow('Privacy notifications must target a user');
    });

    it('should allow creation with valid subscription and/or user', async () => {
      const userId = new mongoose.Types.ObjectId();
      const subscriptionId = new mongoose.Types.ObjectId();

      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          user: userId,
          category: 'ride_updates',
          statusHistory: [{ status: 'queued' }],
        })
      ).resolves.toBeDefined();

      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          subscription: subscriptionId,
          category: 'ride_updates',
          statusHistory: [{ status: 'queued' }],
        })
      ).resolves.toBeDefined();

      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          user: userId,
          subscription: subscriptionId,
          category: 'ride_updates',
          statusHistory: [{ status: 'queued' }],
        })
      ).resolves.toBeDefined();
    });

    it('should prevent sensitive information in payload', async () => {
      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          user: new mongoose.Types.ObjectId(),
          category: 'ride_updates',
          payload: JSON.stringify({ password: 'secret' }),
          statusHistory: [{ status: 'queued' }],
        })
      ).rejects.toThrow('Notification payload cannot contain sensitive information');

      await expect(
        NotificationEventModel.create({
          kind: 'notification',
          user: new mongoose.Types.ObjectId(),
          category: 'ride_updates',
          statusHistory: [{ status: 'queued', details: JSON.stringify({ token: 'abc' }) }],
        })
      ).rejects.toThrow('Notification payload cannot contain sensitive information');
    });
  });

  describe('SearchEventModel', () => {
    it('should validate durationMs and resultsCount are non-negative', async () => {
      await expect(
        SearchEventModel.create({
          kind: 'search',
          user: new mongoose.Types.ObjectId(),
          durationMs: -1,
          resultsCount: 0,
        })
      ).rejects.toThrow(); // Mongoose validation error for min

      await expect(
        SearchEventModel.create({
          kind: 'search',
          user: new mongoose.Types.ObjectId(),
          durationMs: 100,
          resultsCount: -5,
        })
      ).rejects.toThrow(); // Mongoose validation error for min
    });
  });
});
