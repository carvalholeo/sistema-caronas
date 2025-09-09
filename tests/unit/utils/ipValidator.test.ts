
import { ipValidator } from '../../../src/utils/ipValidator';

describe('ipValidator', () => {
  // Valid IPv4 tests
  it('should return true for a valid IPv4 address', () => {
    expect(ipValidator('192.168.1.1')).toBe(true);
    expect(ipValidator('0.0.0.0')).toBe(true);
    expect(ipValidator('255.255.255.255')).toBe(true);
    expect(ipValidator('10.0.0.1')).toBe(true);
  });

  // Invalid IPv4 tests
  it('should return false for an invalid IPv4 address', () => {
    expect(ipValidator('192.1668.1.1')).toBe(false);
    expect(ipValidator('192.168.1.256')).toBe(false);
    expect(ipValidator('192.168.1')).toBe(false);
    expect(ipValidator('abc.def.ghi.jkl')).toBe(false);
    expect(ipValidator('192.168.1.1.1')).toBe(false);
  });

  // Valid IPv6 tests
  it('should return true for a valid IPv6 address', () => {
    expect(ipValidator('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(ipValidator('2001:db8::1')).toBe(true);
    expect(ipValidator('::1')).toBe(true);
    expect(ipValidator('fe80::1ff:fe23:4567:890a')).toBe(true);
    expect(ipValidator('::')).toBe(true);
  });

  // Invalid IPv6 tests
  it('should return false for an invalid IPv6 address', () => {
    expect(ipValidator('2001:0db8:::1')).toBe(false);
    expect(ipValidator('2001:0db8:85a3:0000:0000:8a2e:0370:7334:1234')).toBe(false);
    expect(ipValidator('invalid-ipv6')).toBe(false);
    expect(ipValidator('2001:0db8:85a3:0000:0000:8a2e:0370:733G')).toBe(false);
  });

  // Mixed and other invalid inputs
  it('should return false for non-IP strings', () => {
    expect(ipValidator('localhost')).toBe(false);
    expect(ipValidator('')).toBe(false);
    expect(ipValidator(null as any)).toBe(false);
    expect(ipValidator(undefined as any)).toBe(false);
  });
});
