import { isIP } from "node:net";

export function ipValidator(ip: string): boolean {
  return isIP(ip) !== 0;
}
