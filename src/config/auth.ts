import { config } from 'dotenv';

config();

const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
  jwtExpiration: process.env.JWT_EXPIRATION || '1h',
  jwtLongExpiration: process.env.JWT_EXPIRATION || '7d',
  jwt2FAExpiration: process.env.JWT_2FA_EXPIRATION || '5m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret',
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  saltRounds: parseInt(process.env.SALT_ROUNDS || '12', 10),
};

export default authConfig;