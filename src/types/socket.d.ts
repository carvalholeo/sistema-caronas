import { Types } from 'mongoose';
import 'socket.io';

declare module 'socket.io' {
  // Aqui você estende a interface original do Socket
  export interface Socket {
    // Adicione as suas propriedades personalizadas com os tipos corretos
    userId: Types.ObjectId;
    sessionId: string;
  }
  export interface RemoteSocket {
    userId: string;
  }
}
