import { teardownTestDatabase } from './setup';

export default async () => {
  await teardownTestDatabase();
};
