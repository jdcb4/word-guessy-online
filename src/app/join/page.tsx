'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { socketService } from '@/services/socket';
import { Button } from '@/components/Button';

export default function JoinGamePage() {
  const router = useRouter();
  const [gameCode, setGameCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinGame = useCallback(async () => {
    console.log("Join Game button clicked");
    if (!gameCode || !teamName) {
      setError('Please fill in all fields');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      console.log('Attempting to join game:', { gameCode, teamName });
      
      // Get socket and ensure it's connected
      const socket = socketService.getSocket();
      
      console.log('Socket status before join:', { 
        id: socket.id, 
        connected: socket.connected,
        disconnected: socket.disconnected
      });
      
      // Ensure we're connected before proceeding
      if (!socket.connected) {
        console.log('Socket not connected, connecting now...');
        socket.connect();
        
        // Wait for connection
        await new Promise<void>((resolve, reject) => {
          const connectTimeout = setTimeout(() => {
            console.log('Connection timeout');
            reject(new Error('Unable to connect to server'));
          }, 3000);
          
          socket.once('connect', () => {
            console.log('Connected to server');
            clearTimeout(connectTimeout);
            resolve();
          });
        });
      }
      
      // Remove any existing listeners to prevent duplicates
      socket.off('game-joined');
      socket.off('error');
      
      // Setup promise to wait for response
      const joinPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('Join request timed out');
          reject(new Error('Join request timed out'));
        }, 5000);
        
        socket.once('game-joined', (data) => {
          console.log('Received game-joined event:', data);
          clearTimeout(timeout);
          resolve(data);
        });
        
        socket.once('error', (error) => {
          console.log('Received error event:', error);
          clearTimeout(timeout);
          reject(new Error(error.message));
        });
      });
      
      // Emit the join event
      console.log('Emitting join-team event with:', { 
        gameCode: gameCode.toUpperCase(), 
        teamName 
      });
      
      socket.emit('join-team', { 
        gameCode: gameCode.toUpperCase(), 
        teamName 
      });
      
      // Wait for response
      await joinPromise;
      console.log('Successfully joined game');
      router.push(`/game/${gameCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining game:', error);
      setError(error.message || 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  }, [gameCode, teamName, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center gradient-heading">
          Join Game
        </h1>

        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-100 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Game Code
            </label>
            <input
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              className="w-full p-2 border rounded"
              placeholder="Enter game code"
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Enter team name"
              maxLength={20}
            />
          </div>

          <Button
            onClick={handleJoinGame}
            disabled={isJoining || !gameCode || !teamName}
            variant="primary"
            size="lg"
            fullWidth
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </Button>
        </div>
      </div>
    </div>
  );
} 