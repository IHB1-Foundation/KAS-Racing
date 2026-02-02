import { useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { createGameConfig, type GameMode, FreeRunScene, DuelScene } from '../game';

export interface GameStats {
  distance: number;
  speed: number;
  checkpoints: number;
  isPlaying: boolean;
  isGameOver: boolean;
  timeRemaining?: number;
}

export interface CheckpointEvent {
  seq: number;
  distance: number;
  time: number;
}

export interface GameOverEvent {
  distance: number;
  checkpoints: number;
  time: number;
}

export interface RaceEndEvent {
  distance: number;
  time: number;
}

interface GameCanvasProps {
  mode: GameMode;
  onGameReady?: (game: Phaser.Game) => void;
  onStatsUpdate?: (stats: GameStats) => void;
  onCheckpoint?: (event: CheckpointEvent) => void;
  onGameOver?: (event: GameOverEvent) => void;
  onGameStart?: () => void;
  onRaceEnd?: (event: RaceEndEvent) => void;
}

export function GameCanvas({
  mode,
  onGameReady,
  onStatsUpdate,
  onCheckpoint,
  onGameOver,
  onGameStart,
  onRaceEnd,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const statsIntervalRef = useRef<number | null>(null);

  const setupEventHandlers = useCallback(
    (game: Phaser.Game) => {
      const sceneKey = mode === 'freerun' ? 'FreeRunScene' : 'DuelScene';
      const scene = game.scene.getScene(sceneKey) as FreeRunScene | DuelScene | null;
      if (!scene) return;

      // Listen for game events
      scene.events.on('gameStart', () => {
        onGameStart?.();
      });

      // FreeRun specific events
      if (mode === 'freerun') {
        scene.events.on('checkpointCollected', (event: CheckpointEvent) => {
          onCheckpoint?.(event);
        });

        scene.events.on('gameOver', (event: GameOverEvent) => {
          onGameOver?.(event);
        });
      }

      // Duel specific events
      if (mode === 'duel') {
        scene.events.on('raceEnd', (event: RaceEndEvent) => {
          onRaceEnd?.(event);
        });
      }

      // Poll for stats updates
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }

      statsIntervalRef.current = window.setInterval(() => {
        if (scene && typeof scene.getGameState === 'function') {
          const state = scene.getGameState();
          onStatsUpdate?.({
            distance: Math.floor(state.distance),
            speed: Math.floor(state.speed),
            checkpoints: 'checkpoints' in state ? state.checkpoints : 0,
            isPlaying: state.isPlaying,
            isGameOver: state.isGameOver,
            timeRemaining: 'timeRemaining' in state ? state.timeRemaining : undefined,
          });
        }
      }, 100);
    },
    [mode, onGameStart, onCheckpoint, onGameOver, onRaceEnd, onStatsUpdate],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing game if any
    if (gameRef.current) {
      gameRef.current.destroy(true);
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    // Create new game instance
    const config = createGameConfig(containerRef.current, mode);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Start the appropriate scene after boot
    game.events.once('ready', () => {
      const sceneKey = mode === 'freerun' ? 'FreeRunScene' : 'DuelScene';
      game.scene.start(sceneKey);

      // Setup event handlers after scene is started
      setTimeout(() => {
        setupEventHandlers(game);
      }, 100);

      onGameReady?.(game);
    });

    // Cleanup on unmount
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [mode, onGameReady, setupEventHandlers]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}
