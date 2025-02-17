import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect() {
    if (!this.socket) {
      this.socket = io('http://localhost:3001');
      
      this.socket.on('connect', () => {
        console.log('Connected to server');
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }
    return this.socket;
  }

  getSocket() {
    if (!this.socket) {
      throw new Error('Socket not connected. Call connect() first.');
    }
    return this.socket;
  }
}

export const socketService = SocketService.getInstance(); 