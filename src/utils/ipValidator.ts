import { isIP } from 'net';

export function ipValidator(ip: string): boolean {
  return isIP(ip) !== 0;
}
