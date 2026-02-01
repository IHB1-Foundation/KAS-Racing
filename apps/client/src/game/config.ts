import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { FreeRunScene } from './scenes/FreeRunScene';
import { DuelScene } from './scenes/DuelScene';

export type GameMode = 'freerun' | 'duel';

export function createGameConfig(
  parent: string | HTMLElement,
  mode: GameMode,
): Phaser.Types.Core.GameConfig {
  const scenes = [BootScene];

  if (mode === 'freerun') {
    scenes.push(FreeRunScene);
  } else if (mode === 'duel') {
    scenes.push(DuelScene);
  }

  return {
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    backgroundColor: '#0b1020',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: scenes,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
  };
}
