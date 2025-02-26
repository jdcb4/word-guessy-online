import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private readonly serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

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
          if (this.socket?.io?.engine?.transport?.name === 'websocket') {
            console.log('Falling back to polling transport');
            this.socket.io.opts.transports = ['polling'];
          }
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
        });

        if (!this.socket.connected) {
          this.socket.connect();
        }
      }
      return this.socket;
    } catch (error) {
      console.error('Socket initialization error:', error);
      console.error('Init error stack:', error.stack);
      throw error;
    }
  }

  getSocket(): Socket {
    if (!this.socket) {
      console.log('No socket exists, creating new socket');
      this.socket = this.connect();
    }
    
    if (this.socket && !this.socket.connected) {
      console.log('Socket exists but not connected, attempting to connect');
      this.socket.connect();
    }
    
    console.log('getSocket returning socket:', {
      id: this.socket.id,
      connected: this.socket.connected
    });
    
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService(); 