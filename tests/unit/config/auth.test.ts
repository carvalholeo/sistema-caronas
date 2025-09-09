describe('Auth Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clears the cache
    process.env = { ...originalEnv }; // Restore original env variables
  });

  afterAll(() => {
    process.env = originalEnv; // Restore original env at the end
  });

  it('should use default values when environment variables are not set', () => {
    // Unset environment variables for this test
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRATION;
    delete process.env.REFRESH_TOKEN_SECRET;
    delete process.env.REFRESH_TOKEN_EXPIRATION;
    delete process.env.SALT_ROUNDS;

    const config = require('../../../src/config/auth').default;

    expect(config.jwtSecret).toBe('your_jwt_secret');
    expect(config.jwtExpiration).toBe('1h');
    expect(config.refreshTokenSecret).toBe('your_refresh_token_secret');
    expect(config.refreshTokenExpiration).toBe('7d');
    expect(config.saltRounds).toBe(12);
  });

  it('should use environment variables when they are set', () => {
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_EXPIRATION = '2h';
    process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
    process.env.REFRESH_TOKEN_EXPIRATION = '14d';
    process.env.SALT_ROUNDS = '15';

    const config = require('../../../src/config/auth').default;

    expect(config.jwtSecret).toBe('test_secret');
    expect(config.jwtExpiration).toBe('2h');
    expect(config.refreshTokenSecret).toBe('test_refresh_secret');
    expect(config.refreshTokenExpiration).toBe('14d');
    expect(config.saltRounds).toBe(15);
  });

  it('should correctly parse SALT_ROUNDS as an integer', () => {
    process.env.SALT_ROUNDS = '10';
    const config = require('../../../src/config/auth').default;
    expect(typeof config.saltRounds).toBe('number');
    expect(config.saltRounds).toBe(10);
  });
});
