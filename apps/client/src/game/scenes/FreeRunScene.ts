import Phaser from 'phaser';

export class FreeRunScene extends Phaser.Scene {
  private infoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'FreeRunScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background gradient effect
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0b1020, 0x0b1020, 0x16214a, 0x16214a);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add
      .text(width / 2, 60, 'FREE RUN', {
        font: 'bold 32px monospace',
        color: '#6ee7ff',
      })
      .setOrigin(0.5);

    // 3-lane visualization (placeholder)
    const laneWidth = 100;
    const laneHeight = height - 200;
    const startX = width / 2 - laneWidth * 1.5;
    const startY = 120;

    for (let i = 0; i < 3; i++) {
      const lane = this.add.graphics();
      lane.lineStyle(2, 0x6ee7ff, 0.3);
      lane.strokeRect(startX + i * laneWidth, startY, laneWidth, laneHeight);

      this.add
        .text(startX + i * laneWidth + laneWidth / 2, startY + 20, `Lane ${i + 1}`, {
          font: '14px monospace',
          color: '#aab3d6',
        })
        .setOrigin(0.5);
    }

    // Player placeholder
    const playerX = width / 2;
    const playerY = height - 150;
    const player = this.add.graphics();
    player.fillStyle(0x6ee7ff, 1);
    player.fillTriangle(playerX, playerY - 30, playerX - 20, playerY + 10, playerX + 20, playerY + 10);

    // Info text
    this.infoText = this.add
      .text(width / 2, height - 40, 'Press SPACE to start | LEFT/RIGHT to move', {
        font: '16px monospace',
        color: '#aab3d6',
      })
      .setOrigin(0.5);

    // Instructions
    this.add
      .text(width / 2, height - 80, '3-Lane Runner - Collect Checkpoints for KAS Rewards', {
        font: '14px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  update() {
    // Game logic will be implemented in T-011
  }
}
