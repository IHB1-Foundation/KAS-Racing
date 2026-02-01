import Phaser from 'phaser';

export class DuelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DuelScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0b1020, 0x0b1020, 0x1a1433, 0x1a1433);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add
      .text(width / 2, 60, 'GHOST-WHEEL DUEL', {
        font: 'bold 32px monospace',
        color: '#ff6eb4',
      })
      .setOrigin(0.5);

    // VS indicator
    this.add
      .text(width / 2, height / 2, 'VS', {
        font: 'bold 64px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Player placeholders
    this.add
      .text(width / 4, height / 2, 'PLAYER 1', {
        font: '24px monospace',
        color: '#6ee7ff',
      })
      .setOrigin(0.5);

    this.add
      .text((width * 3) / 4, height / 2, 'PLAYER 2', {
        font: '24px monospace',
        color: '#ff6eb4',
      })
      .setOrigin(0.5);

    // Info
    this.add
      .text(width / 2, height - 80, '30-Second Race | Deposit KAS to Play', {
        font: '16px monospace',
        color: '#aab3d6',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 40, 'Waiting for opponent...', {
        font: '14px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  update() {
    // Duel game logic will be implemented in T-061
  }
}
