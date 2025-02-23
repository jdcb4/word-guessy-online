'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@/components/Button';
import { socketService } from '@/services/socketService';
import { RootState, gameActions } from '@/store';
import { ActiveTeamView } from '@/components/ActiveTeamView';
import { SpectatorView } from '@/components/SpectatorView';
import { TurnEndSummary } from '@/components/TurnEndSummary';
import { TurnGetReady } from '@/components/TurnGetReady';
import { EndGame } from '@/components/EndGame';

type GamePhase = 'turn-ready' | 'playing' | 'turn-end' | 'game-over' | 'loading';

export default function Game() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const [gamePhase, setGamePhase] = useState<GamePhase>('loading');
  
  const { currentGame, teams } = useSelector((state: RootState) => state.game);
  const isMyTurn = currentGame?.currentTeamIndex !== undefined && 
    teams[currentGame.currentTeamIndex]?.id === socketService.getSocket().id;

  // Add effect to handle initial game state
  useEffect(() => {
    const socket = socketService.getSocket();
    
    // Request initial game state when component mounts
    socket.emit('get-game-state', { gameCode: params.code });

    // Handle initial game state
    socket.on('game-state', (data) => {
      console.log('Initial game state received:', data);
      dispatch(gameActions.setCurrentGame(data));
      setGamePhase('turn-ready'); // Set initial phase to turn-ready
    });

    socket.on('turn-ready', (data) => {
      console.log('Turn ready received:', data);
      setGamePhase('turn-ready');
      dispatch(gameActions.setCurrentGame(data));
    });

    socket.on('game-state-update', (data) => {
      console.log('Game state update received:', data);
      setGamePhase('playing');
      dispatch(gameActions.setCurrentGame(data));
    });

    socket.on('turn-ended', (data) => {
      console.log('Turn ended received:', data);
      setGamePhase('turn-end');
      dispatch(gameActions.setCurrentGame(data));
    });

    socket.on('game-ended', (data) => {
      console.log('Game ended received:', data);
      setGamePhase('game-over');
      dispatch(gameActions.setCurrentGame(data));
    });

    return () => {
      socket.off('game-state');
      socket.off('turn-ready');
      socket.off('game-state-update');
      socket.off('turn-ended');
      socket.off('game-ended');
    };
  }, [dispatch, params.code]);

  const handleGameStateUpdate = useCallback((gameState: any) => {
    dispatch(gameActions.setCurrentGame(gameState));
    setIsMyTurn(
      teams[gameState.currentTeamIndex]?.id === socketService.getSocket().id
    );
  }, [dispatch, teams]);

  const handleTurnEnd = useCallback(() => {
    setGamePhase('turn-end');
  }, []);

  const handleTurnReady = useCallback(() => {
    setGamePhase('turn-ready');
  }, []);

  const handleGameEnd = useCallback((data: {
    winner: string;
    finalScores: Record<string, number>;
  }) => {
    setGamePhase('game-over');
  }, []);

  const handleCorrectGuess = () => {
    if (!currentGame?.currentWord?.word) return;
    
    const socket = socketService.getSocket();
    socket.emit('word-guessed', {
      gameCode: params.code,
      word: currentGame.currentWord.word
    });
  };

  const handleSkip = () => {
    const socket = socketService.getSocket();
    socket.emit('word-skipped', {
      gameCode: params.code,
      word: currentGame?.currentWord?.word
    });
  };

  // Action handlers
  const handleEndTurn = () => {
    const socket = socketService.getSocket();
    socket.emit('end-turn', { gameCode: params.code });
  };

  const handleStartTurn = () => {
    const socket = socketService.getSocket();
    socket.emit('start-turn', { gameCode: params.code });
    setGamePhase('playing');
  };

  const handleBackToHome = () => {
    dispatch(gameActions.resetGame());
    router.push('/');
  };

  const handlePlayAgain = () => {
    // To be implemented later
  };

  // Render different game phases
  if (!currentGame) {
    return <div>Loading...</div>;
  }

  switch (gamePhase) {
    case 'turn-ready':
      return (
        <TurnGetReady
          onStartTurn={handleStartTurn}
          isActiveTeam={isMyTurn}
        />
      );

    case 'turn-end':
      return (
        <TurnEndSummary 
          onEndTurn={handleEndTurn}
          isActiveTeam={isMyTurn}
        />
      );

    case 'game-over':
      return (
        <EndGame
          onPlayAgain={handlePlayAgain}
          onBackToHome={handleBackToHome}
        />
      );

    case 'playing':
      return (
        <div className="min-h-screen flex flex-col items-center p-4">
          {isMyTurn ? (
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
          )}
        </div>
      );

    default:
      return <div>Loading...</div>;
  }
} 