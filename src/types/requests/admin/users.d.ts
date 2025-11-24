export interface IAdminListUsersQuery {
  status?: UserStatus;
  role?: UserRole;
  name?: string;
  email?: string;
  matricula?: string;
  twoFactorEnabled?: 'true' | 'false';
  sortBy?: 'createdAt' | 'name' | 'lastLogin';
  sortOrder?: 'asc' | 'desc';
}

