import mongoose from 'mongoose';
import { IUser, IAccessibilitySettings } from '../src/types';
import { UserRole, UserStatus } from '../src/types/enums/enums';

// Create a minimal mock type with just the fields we need for testing

import { Document } from 'mongoose';

export type MockUser = IUser & Document & {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  matricula: string;
  password: string;
  roles: UserRole[];
  permissions: string[];
  status: UserStatus;
  twoFactorSecret: string;
  twoFactorEnabled: boolean;
  forcePasswordChangeOnNextLogin: boolean;
  sessionVersion: number;
  accessibilitySettings: {
    highContrast: boolean;
    largeFont: boolean;
    reduceAnimations: boolean;
    muteSounds: boolean;
  };
  languagePreference: string;
  profilePictureUrl?: string;
  comparePassword: jest.Mock;
  save: jest.Mock;
  isTemporaryEmail: jest.Mock;
  __v: number;
};

export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => {
  const defaultUser: Partial<MockUser> = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test User',
    email: 'test@example.com',
    matricula: 'A123',
    password: 'hashedpassword',
    roles: [],
    permissions: [],
    status: UserStatus.Approved,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    forcePasswordChangeOnNextLogin: false,
    sessionVersion: 1,
    lastLogin: new Date(),
    accessibilitySettings: {
      _id: new mongoose.Types.ObjectId(),
      highContrast: false,
      largeFont: false,
      reduceAnimations: false,
      muteSounds: false,
      toObject: jest.fn(),
      toJSON: jest.fn(),
      isModified: jest.fn(),
    } as unknown as IAccessibilitySettings,
    languagePreference: 'pt-BR',
    profilePictureUrl: '',
    comparePassword: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    isTemporaryEmail: jest.fn().mockReturnValue(false),
    __v: 0,
  };

  // Always include __v in the returned mock for Mongoose compatibility
  const base = { ...defaultUser, ...overrides, __v: 0 } as MockUser;
  // Add Document methods to mock
  // Remove custom toJSON and toObject mocks to avoid type incompatibility
  (base as any).isModified = jest.fn(() => false);
  (base as any).$isDeleted = false;
  (base as any).$locals = {};
  (base as any).$op = undefined;
  (base as any).$session = jest.fn();
  (base as any).$set = jest.fn();
  (base as any).$getAllSubdocs = jest.fn(() => []);
  (base as any).$ignore = jest.fn();
  (base as any).$isDefault = jest.fn(() => false);
  (base as any).$isEmpty = jest.fn(() => false);
  (base as any).$isValid = jest.fn(() => true);
  (base as any).$locals = {};
  (base as any).$markValid = jest.fn();
  (base as any).$model = jest.fn();
  (base as any).$populated = {};
  (base as any).$session = jest.fn();
  (base as any).$set = jest.fn();
  (base as any).$toObject = jest.fn(() => base);
  (base as any).$validate = jest.fn();
  (base as any).$where = jest.fn();
  return base;
};