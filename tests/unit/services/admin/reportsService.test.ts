
import { adminReportsService } from '../../../../src/services/admin/reportsService';
import { UserModel } from '../../../../src/models/user';
import { AuditLogModel } from '../../../../src/models/auditLog';
import { UserStatus, AuditActionType } from '../../../../src/types/enums/enums';

// Mock all models used in reportsService
jest.mock('../../../src/models/user');
jest.mock('../../../src/models/vehicle');
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/chat');
jest.mock('../../../src/models/event');
jest.mock('../../../src/models/loginAttempt');
jest.mock('../../../src/models/passwordReset');
jest.mock('../../../src/models/auditLog');
jest.mock('../../../src/models/privacyRequest');
jest.mock('../../../src/models/dataReport');
jest.mock('../../../src/models/block');
jest.mock('../../../src/models/notificationSubscription');
jest.mock('../../../src/models/suppressedNotification');

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;

describe('AdminReportsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRegistrationReport', () => {
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    it('should return zero counts when no registrations are found', async () => {
      mockedUserModel.aggregate.mockResolvedValue([]);

      const report = await adminReportsService.getRegistrationReport(startDate, endDate);

      expect(report).toEqual({
        totalRegistrations: 0,
        approvalRate: 0,
        rejectionRate: 0,
        averageDecisionTimeHours: '0.00',
        pendingCount: 0,
      });
      expect(mockedUserModel.aggregate).toHaveBeenCalledTimes(1);
    });

    it('should correctly calculate registration metrics without decision logs', async () => {
      mockedUserModel.aggregate.mockResolvedValue([
        {
          _id: null,
          totalRegistrations: 10,
          approved: 5,
          rejected: 3,
          pending: 2,
          totalDecisionTime: 0,
          decidedCount: 0,
        },
      ]);

      const report = await adminReportsService.getRegistrationReport(startDate, endDate);

      expect(report).toEqual({
        totalRegistrations: 10,
        approvalRate: 0.5,
        rejectionRate: 0.3,
        averageDecisionTimeHours: '0.00',
        pendingCount: 2,
      });
    });

    it('should correctly calculate registration metrics with decision logs', async () => {
      const user1CreatedAt = new Date('2023-01-05T10:00:00.000Z');
      const user1DecisionAt = new Date('2023-01-05T11:00:00.000Z'); // 1 hour later
      const user2CreatedAt = new Date('2023-01-10T10:00:00.000Z');
      const user2DecisionAt = new Date('2023-01-10T12:00:00.000Z'); // 2 hours later

      mockedUserModel.aggregate.mockResolvedValue([
        {
          _id: null,
          totalRegistrations: 3,
          approved: 2,
          rejected: 1,
          pending: 0,
          totalDecisionTime: (user1DecisionAt.getTime() - user1CreatedAt.getTime()) + (user2DecisionAt.getTime() - user2CreatedAt.getTime()),
          decidedCount: 2,
        },
      ]);

      const report = await adminReportsService.getRegistrationReport(startDate, endDate);

      // Total decision time: 1 hour (3600000ms) + 2 hours (7200000ms) = 10800000ms
      // Average decision time: 10800000ms / 2 = 5400000ms
      // 5400000ms / (1000 * 60 * 60) = 1.5 hours
      expect(report).toEqual({
        totalRegistrations: 3,
        approvalRate: 2 / 3,
        rejectionRate: 1 / 3,
        averageDecisionTimeHours: '1.50',
        pendingCount: 0,
      });
    });

    it('should pass correct aggregation pipeline to UserModel.aggregate', async () => {
        mockedUserModel.aggregate.mockResolvedValue([]);
        await adminReportsService.getRegistrationReport(startDate, endDate);

        const expectedPipeline = [
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $lookup: {
                    from: 'AuditLog',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$target.resourceId', '$$userId'] },
                                        { $eq: ['$target.resourceType', 'User'] },
                                        { $in: ['$action.actionType', [
                                            AuditActionType.USER_APPROVED_BY_ADMIN,
                                            AuditActionType.USER_REJECTED_BY_ADMIN
                                        ]]
                                        }
                                    ]
                                }
                            }
                        },
                        { $sort: { createdAt: 1 } },
                        { $limit: 1 }
                    ],
                    as: 'decisionLog'
                }
            },
            {
                $addFields: {
                    decisionEntry: { $arrayElemAt: ['$decisionLog', 0] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRegistrations: { $sum: 1 },
                    approved: { $sum: { $cond: [{ $eq: ['$status', UserStatus.Approved] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', UserStatus.Rejected] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', UserStatus.Pending] }, 1, 0] } },
                    totalDecisionTime: {
                        $sum: {
                            $cond: [
                                '$decisionEntry',
                                { $subtract: ['$decisionEntry.createdAt', '$createdAt'] },
                                0
                            ]
                        }
                    },
                    decidedCount: { $sum: { $cond: ['$decisionEntry', 1, 0] } }
                }
            }
        ];
        expect(mockedUserModel.aggregate).toHaveBeenCalledWith(expectedPipeline);
    });
  });
});
