import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private readonly serverUrl = 'http://localhost:3001';

  connect(): Socket {
    try {
      if (!this.socket) {
        console.log('Initializing new socket connection...');
        this.socket = io(this.serverUrl, {
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          withCredentials: true,
          forceNew: true,
        });

        this.socket.on('connect', () => {
          console.log('Socket connected successfully:', {
            id: this.socket?.id,
            connected: this.socket?.connected,
            transport: this.socket?.io?.engine?.transport?.name
          });
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          if (this.socket && this.socket.io) {
            const currentTransport = this.socket.io.engine?.transport?.name;
            console.log('Current transport:', currentTransport);
            
            if (currentTransport === 'websocket') {
              console.log('Falling back to polling transport');
              this.socket.io.opts.transports = ['polling'];
            }
          }
        });

        this.socket.on('error', (error) => {
          console.error('Socket general error:', error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          if (reason === 'io server disconnect') {
            this.socket?.connect();
          }
        });
      }
      return this.socket;
    } catch (error) {
      console.error('Socket initialization error:', error);
      console.error('Init error stack:', error.stack);
      throw error;
    }
  }

  getSocket(): Socket {
    if (!this.socket || !this.socket.connected) {
      return this.connect();
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService(); 