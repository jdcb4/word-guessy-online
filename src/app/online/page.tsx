'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { socketService } from '@/services/socketService';
import { gameActions, RootState } from '@/store';

type Tab = 'host' | 'join';

export default function OnlineSetup() {
  const [activeTab, setActiveTab] = useState<Tab>('host');
  const [teamName, setTeamName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const dispatch = useDispatch();
  const { settings } = useSelector((state: RootState) => state.game);

  // Memoize the handlers to keep them stable between renders
  const handleGameCreated = useCallback(({ gameCode }: { gameCode: string }) => {
    dispatch(gameActions.setGameCode(gameCode));
    dispatch(gameActions.setIsHost(true));
    dispatch(gameActions.setTeams([{ 
      id: socketService.getSocket().id, 
      name: teamName 
    }]));
    router.push(`/waiting-room/${gameCode}`);
  }, [dispatch, router, teamName]);

  const handleGameUpdate = useCallback((data: { 
    teams: Array<{ id: string; name: string }>;
    settings?: GameSettings;
  }) => {
    if (data.teams) {
      dispatch(gameActions.setTeams(data.teams));
    }
    if (data.settings) {
      dispatch(gameActions.updateSettings(data.settings));
    }
  }, [dispatch]);

  const handleError = useCallback((data: { message: string }) => {
    setError(data?.message || 'An error occurred');
  }, []);

  // Add a handler for successful game join
  const handleGameJoined = useCallback((data: { gameCode: string }) => {
    if (data && data.gameCode) {
      dispatch(gameActions.setGameCode(data.gameCode));
      dispatch(gameActions.setIsHost(false));
      router.push(`/waiting-room/${data.gameCode}`);
    }
  }, [dispatch, router]);

  useEffect(() => {
    console.log('Setting up socket listeners...');
    const socket = socketService.connect();

    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Connection error. Please try again.');
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('game-created', (data) => {
      console.log('Game created:', data);
      handleGameCreated(data);
    });

    socket.on('game-updated', (data) => {
      console.log('Game updated:', data);
      handleGameUpdate(data);
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data);
      handleError(data);
    });

    socket.on('game-joined', (data) => {
      console.log('Game joined:', data);
      handleGameJoined(data);
    });

    return () => {
      console.log('Cleaning up socket listeners...');
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('game-created');
      socket.off('game-updated');
      socket.off('error');
      socket.off('game-joined');
    };
  }, [handleGameCreated, handleGameUpdate, handleError, handleGameJoined]);

  const handleHostGame = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Team Name:', teamName);
      console.log('Current Settings:', settings);
      
      if (!teamName.trim()) {
        setError('Team name is required');
        return;
      }
      setError(null);
      
      const socket = socketService.getSocket();
      console.log('Socket Status:', {
        id: socket.id,
        connected: socket.connected,
        disconnected: socket.disconnected
      });
      
      // Emit the host-game event with current settings
      socket.emit('host-game', {
        teamName: teamName.trim(),
        settings: {
          ...settings,
          turnDuration: settings.turnDuration || 30,
          categories: settings.categories || [],
          difficulties: settings.difficulties || ['easy']
        }
      });
      
      console.log('Host game event emitted');
    } catch (error) {
      console.error('Detailed hosting error:', error);
      console.error('Error stack:', error.stack);
      setError('Failed to create game. Please try again.');
    }
  }, [teamName, settings]);

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !gameCode.trim()) {
      setError('Both team name and game code are required');
      return;
    }
    setError(null);
    const socket = socketService.getSocket();
    const upperGameCode = gameCode.trim().toUpperCase();
    
    socket.emit('join-team', {
      gameCode: upperGameCode,
      teamName: teamName.trim()
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-8">Online Setup</h1>
      
      {error && (
        <div className="w-full max-w-md mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="w-full max-w-md">
        <div className="flex mb-6">
          <button
            className={`flex-1 py-2 ${activeTab === 'host' ? 'border-b-2 border-foreground' : 'border-b border-foreground/20'}`}
            onClick={() => setActiveTab('host')}
          >
            Host Game
          </button>
          <button
            className={`flex-1 py-2 ${activeTab === 'join' ? 'border-b-2 border-foreground' : 'border-b border-foreground/20'}`}
            onClick={() => setActiveTab('join')}
          >
            Join Game
          </button>
        </div>

        {activeTab === 'host' ? (
          <form onSubmit={handleHostGame} className="flex flex-col gap-4">
            <div>
              <label htmlFor="hostTeamName" className="block mb-2">Team Name</label>
              <input
                id="hostTeamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full p-2 border rounded bg-background text-foreground"
                required
              />
            </div>
            <Button type="submit" fullWidth>Create Game</Button>
          </form>
        ) : (
          <form onSubmit={handleJoinGame} className="flex flex-col gap-4">
            <div>
              <label htmlFor="gameCode" className="block mb-2">Game Code</label>
              <input
                id="gameCode"
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="w-full p-2 border rounded bg-background text-foreground"
                required
              />
            </div>
            <div>
              <label htmlFor="joinTeamName" className="block mb-2">Team Name</label>
              <input
                id="joinTeamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full p-2 border rounded bg-background text-foreground"
                required
              />
            </div>
            <Button type="submit" fullWidth>Join Game</Button>
          </form>
        )}
      </div>
    </div>
  );
} 