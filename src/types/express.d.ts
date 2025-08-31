import 'express';
import { IUser } from './user';

declare module 'express' {
  export interface Request {
    user?: IUser;
  }
}
