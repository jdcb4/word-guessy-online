'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@/components/Button';
import { socketService } from '@/services/socketService';
import { RootState, gameActions } from '@/store';
import { GameSettings } from '@/components/GameSettings';

export default function WaitingRoom() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  
  const { teams, isHost, gameCode, settings } = useSelector((state: RootState) => state.game);

  // Memoize the game update handler
  const handleGameUpdate = useCallback((data: { teams: Array<{ id: string; name: string }> }) => {
    if (data && Array.isArray(data.teams)) {
      dispatch(gameActions.setTeams(data.teams));
    }
  }, [dispatch]);

  // Memoize the game end handler
  const handleGameEnd = useCallback(({ message }: { message: string }) => {
    alert(message);
    dispatch(gameActions.resetGame());
    router.push('/online');
  }, [dispatch, router]);

  const canStartGame = useMemo(() => {
    return teams.length >= 2 &&
      settings.categories.length > 0 &&
      settings.difficulties.length > 0;
  }, [teams.length, settings.categories.length, settings.difficulties.length]);

  const handleStartGame = () => {
    const socket = socketService.getSocket();
    socket.emit('start-game', { gameCode: params.code });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(params.code as string);
  };

  useEffect(() => {
    const socket = socketService.connect();
    const gameCodeString = params.code as string;

    const handleGameStarted = (data: { redirect: string }) => {
      dispatch(gameActions.setIsPlaying(true));
      router.push(`/game/${gameCodeString}`);
    };

    // Listen for game updates (including initial state)
    socket.on('game-updated', handleGameUpdate);
    socket.on('game-ended', handleGameEnd);
    socket.on('game-started', handleGameStarted);
    socket.on('error', (data: { message: string }) => {
      alert(data.message);
    });

    // Request initial game state when component mounts
    socket.emit('get-game-state', { gameCode: gameCodeString });

    return () => {
      socket.off('game-updated', handleGameUpdate);
      socket.off('game-ended', handleGameEnd);
      socket.off('game-started', handleGameStarted);
      socket.off('error');
    };
  }, [params.code, handleGameUpdate, handleGameEnd, dispatch, router]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-8">Waiting Room</h1>

      <div className="w-full max-w-md">
        <div className="bg-foreground/5 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Game Code:</span>
            <div className="flex gap-2">
              <code className="bg-foreground/10 px-2 py-1 rounded">
                {params.code}
              </code>
              <button
                onClick={handleCopyCode}
                className="text-sm underline underline-offset-2"
              >
                Copy
              </button>
            </div>
          </div>
          <p className="text-sm text-foreground/70">
            Share this code with other players to join the game
          </p>
        </div>

        <div className="mb-6">
          <h2 className="font-medium mb-4">Teams ({teams.length})</h2>
          <ul className="space-y-2">
            {teams.map((team) => (
              <li
                key={team.id}
                className="bg-foreground/5 p-3 rounded-lg flex items-center"
              >
                <span>{team.name}</span>
                {team.id === socketService.getSocket().id && (
                  <span className="ml-2 text-sm text-foreground/50">(You)</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Settings section - only visible to host */}
        {isHost && <GameSettings />}

        {isHost && (
          <Button
            onClick={handleStartGame}
            fullWidth
            disabled={!canStartGame}
          >
            Start Game
          </Button>
        )}

        {!isHost && (
          <p className="text-center text-foreground/70">
            Waiting for host to start the game...
          </p>
        )}
      </div>
    </div>
  );
} 