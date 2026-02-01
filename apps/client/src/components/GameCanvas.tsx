import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig, type GameMode } from '../game';

interface GameCanvasProps {
  mode: GameMode;
  onGameReady?: (game: Phaser.Game) => void;
}

export function GameCanvas({ mode, onGameReady }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing game if any
    if (gameRef.current) {
      gameRef.current.destroy(true);
    }

    // Create new game instance
    const config = createGameConfig(containerRef.current, mode);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Start the appropriate scene after boot
    game.events.once('ready', () => {
      const sceneKey = mode === 'freerun' ? 'FreeRunScene' : 'DuelScene';
      game.scene.start(sceneKey);
      onGameReady?.(game);
    });

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [mode, onGameReady]);

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
