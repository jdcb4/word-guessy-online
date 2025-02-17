'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@/components/Button';
import { socketService } from '@/services/socketService';
import { RootState, gameActions } from '@/store';
import { ActiveTeamView } from '@/components/ActiveTeamView';
import { SpectatorView } from '@/components/SpectatorView';
import { TurnEndScreen } from '@/components/TurnEndScreen';
import { BeginTurnScreen } from '@/components/BeginTurnScreen';

interface TurnEndData {
  nextTeamIndex: number;
  scores: Record<string, number>;
  roundWords: {
    guessed: string[];
    skipped: string[];
  };
  currentTeam: string;
  nextTeam: string;
}

export default function Game() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const { teams, currentGame, settings } = useSelector((state: RootState) => state.game);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [turnEndData, setTurnEndData] = useState<TurnEndData | null>(null);
  const [prepareTurnData, setPrepareTurnData] = useState<any>(null);

  // Handle game state updates from server
  const handleGameStateUpdate = useCallback((gameState: any) => {
    dispatch(gameActions.setCurrentGame(gameState));
    setIsMyTurn(
      teams[gameState.currentTeamIndex]?.id === socketService.getSocket().id
    );
  }, [dispatch, teams]);

  const handleTurnEnd = useCallback((data: TurnEndData) => {
    dispatch(gameActions.updateScore(data.scores));
    setTurnEndData(data);
  }, [dispatch]);

  const handleGameEnd = useCallback((data: {
    winner: string;
    finalScores: Record<string, number>;
  }) => {
    alert(`Game Over! Winner: ${data.winner}`);
    router.push('/online');
  }, [router]);

  useEffect(() => {
    const socket = socketService.connect();
    const gameCodeString = params.code as string;
    
    // Request initial game state when component mounts
    socket.emit('get-game-state', { gameCode: gameCodeString });
    
    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('turn-ended', (data) => {
      setTurnEndData(data);
      handleTurnEnd(data);
    });
    socket.on('game-ended', handleGameEnd);
    socket.on('prepare-turn', (data) => {
      setTurnEndData(null);
      setPrepareTurnData(data);
    });

    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('turn-ended', handleTurnEnd);
      socket.off('game-ended', handleGameEnd);
      socket.off('prepare-turn');
    };
  }, [handleGameStateUpdate, handleTurnEnd, handleGameEnd, params.code]);

  const handleCorrectGuess = () => {
    const socket = socketService.getSocket();
    socket.emit('word-guessed', {
      gameCode: params.code,
      word: currentGame?.currentWord?.word
    });
  };

  const handleSkip = () => {
    const socket = socketService.getSocket();
    socket.emit('word-skipped', {
      gameCode: params.code,
      word: currentGame?.currentWord?.word
    });
  };

  const handleConfirmTurnEnd = () => {
    const socket = socketService.getSocket();
    socket.emit('confirm-turn-end', { gameCode: params.code });
  };

  const handleStartTurn = () => {
    const socket = socketService.getSocket();
    socket.emit('start-turn', { gameCode: params.code });
    setPrepareTurnData(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      {turnEndData && (
        <TurnEndScreen
          {...turnEndData}
          onConfirmEnd={handleConfirmTurnEnd}
        />
      )}
      
      {prepareTurnData && (
        <BeginTurnScreen
          team={prepareTurnData.team}
          isMyTurn={prepareTurnData.teamId === socketService.getSocket().id}
          onStartTurn={handleStartTurn}
        />
      )}

      {!turnEndData && !prepareTurnData && (
        isMyTurn ? (
          <ActiveTeamView
            currentGame={currentGame}
            onCorrectGuess={handleCorrectGuess}
            onSkip={handleSkip}
          />
        ) : (
          <SpectatorView
            currentGame={currentGame}
            teams={teams}
          />
        )
      )}
    </div>
  );
} 