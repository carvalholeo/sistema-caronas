
import helmet from 'helmet';

// Mock the helmet library
jest.mock('helmet');

const mockedHelmet = helmet as jest.Mock;

describe('Helmet CSP Middleware', () => {

  beforeEach(() => {
    mockedHelmet.mockClear();
  });

  it('should be configured with the correct CSP options', () => {
    require('../../../../src/middlewares/security/helmetCSP');

    expect(mockedHelmet).toHaveBeenCalledTimes(1);
    expect(mockedHelmet).toHaveBeenCalledWith({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    });
  });
});
