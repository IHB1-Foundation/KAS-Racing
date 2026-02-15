import Phaser from 'phaser';

const LANE_COUNT = 3;
const LANE_WIDTH = 100;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const PLAYER_SIZE = 30;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_HEIGHT = 40;
const CHECKPOINT_SIZE = 35;

const INITIAL_SPEED = 200;
const MAX_SPEED = 600;
const SPEED_INCREMENT = 5;
const OBSTACLE_SPAWN_INTERVAL = 1500;
const CHECKPOINT_SPAWN_INTERVAL = 2500;

interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  distance: number;
  speed: number;
  currentLane: number;
  checkpoints: number;
  startTime: number;
}

export class FreeRunScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Graphics;
  private obstacles!: Phaser.GameObjects.Group;
  private checkpointCapsules!: Phaser.GameObjects.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private state!: GameState;
  private lanePositions: number[] = [];
  private obstacleTimer?: Phaser.Time.TimerEvent;
  private checkpointTimer?: Phaser.Time.TimerEvent;
  private distanceText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private checkpointText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private lastLaneChange = 0;
  private touchStartX = 0;

  constructor() {
    super({ key: 'FreeRunScene' });
  }

  create() {
    this.state = {
      isPlaying: false,
      isGameOver: false,
      distance: 0,
      speed: INITIAL_SPEED,
      currentLane: 1,
      checkpoints: 0,
      startTime: 0,
    };

    // Calculate lane positions
    const startX = (GAME_WIDTH - LANE_COUNT * LANE_WIDTH) / 2 + LANE_WIDTH / 2;
    for (let i = 0; i < LANE_COUNT; i++) {
      this.lanePositions.push(startX + i * LANE_WIDTH);
    }

    this.createBackground();
    this.createLanes();
    this.createPlayer();
    this.createUI();
    this.createGroups();
    this.setupInput();

    this.showStartPrompt();
  }

  private createBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0b1020, 0x0b1020, 0x16214a, 0x16214a);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createLanes() {
    const startX = (GAME_WIDTH - LANE_COUNT * LANE_WIDTH) / 2;
    const laneGraphics = this.add.graphics();

    // Lane borders
    laneGraphics.lineStyle(2, 0x6ee7ff, 0.3);
    for (let i = 0; i <= LANE_COUNT; i++) {
      const x = startX + i * LANE_WIDTH;
      laneGraphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    // Lane markers (dashed lines simulation)
    laneGraphics.lineStyle(1, 0x6ee7ff, 0.1);
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = startX + i * LANE_WIDTH;
      for (let y = 0; y < GAME_HEIGHT; y += 40) {
        laneGraphics.lineBetween(x, y, x, y + 20);
      }
    }
  }

  private createPlayer() {
    this.player = this.add.graphics();
    this.drawPlayer();
  }

  private drawPlayer() {
    if (!this.lanePositions.length) return;
    const x = this.lanePositions[this.state.currentLane];
    if (x === undefined) return;
    const y = GAME_HEIGHT - 80;

    this.player.clear();
    this.player.fillStyle(0x6ee7ff, 1);
    this.player.fillTriangle(x, y - PLAYER_SIZE, x - PLAYER_SIZE / 2, y + PLAYER_SIZE / 2, x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2);

    // Engine glow
    this.player.fillStyle(0xff6e4a, 0.8);
    this.player.fillCircle(x, y + PLAYER_SIZE / 2 + 5, 8);
  }

  private createUI() {
    // Title
    this.add
      .text(GAME_WIDTH / 2, 25, 'FREE RUN', {
        font: 'bold 24px monospace',
        color: '#6ee7ff',
      })
      .setOrigin(0.5);

    // Stats
    this.distanceText = this.add.text(20, 60, 'Distance: 0 m', {
      font: '16px monospace',
      color: '#ffffff',
    });

    this.speedText = this.add.text(20, 85, 'Speed: 200 km/h', {
      font: '16px monospace',
      color: '#ffffff',
    });

    this.checkpointText = this.add.text(20, 110, 'Checkpoints: 0', {
      font: '16px monospace',
      color: '#6ee7ff',
    });

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
        font: 'bold 28px monospace',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private createGroups() {
    this.obstacles = this.add.group();
    this.checkpointCapsules = this.add.group();
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Space to start
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (!this.state.isPlaying && !this.state.isGameOver) {
        this.startGame();
      } else if (this.state.isGameOver) {
        this.restartGame();
      }
    });

    // Touch input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.touchStartX = pointer.x;

      if (!this.state.isPlaying && !this.state.isGameOver) {
        this.startGame();
      } else if (this.state.isGameOver) {
        this.restartGame();
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.state.isPlaying) return;

      const swipeDistance = pointer.x - this.touchStartX;
      const swipeThreshold = 50;

      if (swipeDistance > swipeThreshold) {
        this.moveRight();
      } else if (swipeDistance < -swipeThreshold) {
        this.moveLeft();
      }
    });
  }

  private showStartPrompt() {
    this.statusText.setText('Press SPACE to Start\n\nLEFT/RIGHT or Swipe to Move');
  }

  private startGame() {
    this.state.isPlaying = true;
    this.state.startTime = Date.now();
    this.statusText.setText('');

    // Start spawning obstacles
    this.obstacleTimer = this.time.addEvent({
      delay: OBSTACLE_SPAWN_INTERVAL,
      callback: () => this.spawnObstacle(),
      loop: true,
    });

    // Start spawning checkpoints
    this.checkpointTimer = this.time.addEvent({
      delay: CHECKPOINT_SPAWN_INTERVAL,
      callback: () => this.spawnCheckpoint(),
      loop: true,
    });

    // Emit game start event
    this.events.emit('gameStart');
  }

  private moveLeft() {
    const now = Date.now();
    if (now - this.lastLaneChange < 100) return;

    if (this.state.currentLane > 0) {
      this.state.currentLane--;
      this.lastLaneChange = now;
      this.drawPlayer();
    }
  }

  private moveRight() {
    const now = Date.now();
    if (now - this.lastLaneChange < 100) return;

    if (this.state.currentLane < LANE_COUNT - 1) {
      this.state.currentLane++;
      this.lastLaneChange = now;
      this.drawPlayer();
    }
  }

  private spawnObstacle() {
    const lane = Phaser.Math.Between(0, LANE_COUNT - 1);
    const x = this.lanePositions[lane];
    if (x === undefined) return;

    const obstacle = this.add.graphics();
    obstacle.fillStyle(0xff4444, 1);
    obstacle.fillRect(-OBSTACLE_WIDTH / 2, -OBSTACLE_HEIGHT / 2, OBSTACLE_WIDTH, OBSTACLE_HEIGHT);
    obstacle.setPosition(x, -OBSTACLE_HEIGHT);

    (obstacle as unknown as { lane: number }).lane = lane;
    this.obstacles.add(obstacle);
  }

  private spawnCheckpoint() {
    // Don't spawn in the same lane as recent obstacles
    const lane = Phaser.Math.Between(0, LANE_COUNT - 1);
    const x = this.lanePositions[lane];
    if (x === undefined) return;

    const checkpoint = this.add.graphics();

    // Capsule shape with glow
    checkpoint.fillStyle(0x00ff88, 0.3);
    checkpoint.fillCircle(0, 0, CHECKPOINT_SIZE + 5);
    checkpoint.fillStyle(0x00ff88, 1);
    checkpoint.fillCircle(0, 0, CHECKPOINT_SIZE / 2);

    // KAS symbol
    const text = this.add
      .text(0, 0, 'K', {
        font: 'bold 16px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const container = this.add.container(x, -CHECKPOINT_SIZE, [checkpoint, text]);
    (container as unknown as { lane: number }).lane = lane;
    this.checkpointCapsules.add(container);
  }

  override update(_time: number, delta: number) {
    if (!this.state.isPlaying) return;

    // Update distance
    const deltaSeconds = delta / 1000;
    this.state.distance += (this.state.speed / 3.6) * deltaSeconds;

    // Increase speed over time
    if (this.state.speed < MAX_SPEED) {
      this.state.speed += SPEED_INCREMENT * deltaSeconds;
    }

    // Handle keyboard input
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.moveLeft();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.moveRight();
    }

    // Move obstacles
    const obstacleSpeed = this.state.speed * 2;
    this.obstacles.getChildren().forEach((obj) => {
      const obstacle = obj as Phaser.GameObjects.Graphics;
      obstacle.y += obstacleSpeed * deltaSeconds;

      // Check collision
      if (this.checkCollision(obstacle)) {
        this.gameOver();
        return;
      }

      // Remove off-screen obstacles
      if (obstacle.y > GAME_HEIGHT + OBSTACLE_HEIGHT) {
        obstacle.destroy();
      }
    });

    // Move checkpoints
    this.checkpointCapsules.getChildren().forEach((obj) => {
      const checkpoint = obj as Phaser.GameObjects.Container;
      checkpoint.y += obstacleSpeed * deltaSeconds;

      // Check collection
      if (this.checkCheckpointCollision(checkpoint)) {
        this.collectCheckpoint(checkpoint);
        return;
      }

      // Remove off-screen checkpoints
      if (checkpoint.y > GAME_HEIGHT + CHECKPOINT_SIZE) {
        checkpoint.destroy();
      }
    });

    // Update UI
    this.distanceText.setText(`Distance: ${Math.floor(this.state.distance)} m`);
    this.speedText.setText(`Speed: ${Math.floor(this.state.speed)} km/h`);
    this.checkpointText.setText(`Checkpoints: ${this.state.checkpoints}`);
  }

  private checkCollision(obstacle: Phaser.GameObjects.Graphics): boolean {
    const obstacleLane = (obstacle as unknown as { lane: number }).lane;
    if (obstacleLane !== this.state.currentLane) return false;

    const playerY = GAME_HEIGHT - 80;
    const playerTop = playerY - PLAYER_SIZE;
    const playerBottom = playerY + PLAYER_SIZE / 2;

    const obstacleTop = obstacle.y - OBSTACLE_HEIGHT / 2;
    const obstacleBottom = obstacle.y + OBSTACLE_HEIGHT / 2;

    return obstacleBottom > playerTop && obstacleTop < playerBottom;
  }

  private checkCheckpointCollision(checkpoint: Phaser.GameObjects.Container): boolean {
    const checkpointLane = (checkpoint as unknown as { lane: number }).lane;
    if (checkpointLane !== this.state.currentLane) return false;

    const playerY = GAME_HEIGHT - 80;
    const distance = Math.abs(checkpoint.y - playerY);

    return distance < CHECKPOINT_SIZE + PLAYER_SIZE;
  }

  private collectCheckpoint(checkpoint: Phaser.GameObjects.Container) {
    this.state.checkpoints++;
    checkpoint.destroy();

    // Visual feedback
    const x = this.lanePositions[this.state.currentLane];
    if (x === undefined) return;
    const y = GAME_HEIGHT - 80;

    const flash = this.add.graphics();
    flash.fillStyle(0x00ff88, 0.5);
    flash.fillCircle(x, y, 50);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => flash.destroy(),
    });

    // Emit checkpoint event
    this.events.emit('checkpointCollected', {
      seq: this.state.checkpoints,
      distance: Math.floor(this.state.distance),
      time: Date.now() - this.state.startTime,
    });
  }

  private gameOver() {
    this.state.isPlaying = false;
    this.state.isGameOver = true;

    this.obstacleTimer?.destroy();
    this.checkpointTimer?.destroy();

    const playTime = Math.floor((Date.now() - this.state.startTime) / 1000);

    this.statusText.setText(
      `GAME OVER\n\nDistance: ${Math.floor(this.state.distance)} m\nTime: ${playTime}s\nCheckpoints: ${this.state.checkpoints}\n\nPress SPACE to Restart`,
    );

    // Emit game over event
    this.events.emit('gameOver', {
      distance: Math.floor(this.state.distance),
      checkpoints: this.state.checkpoints,
      time: playTime,
    });
  }

  private restartGame() {
    this.state = {
      isPlaying: false,
      isGameOver: false,
      distance: 0,
      speed: INITIAL_SPEED,
      currentLane: 1,
      checkpoints: 0,
      startTime: 0,
    };

    this.obstacles.clear(true, true);
    this.checkpointCapsules.clear(true, true);
    this.drawPlayer();
    this.showStartPrompt();
  }

  // Public method to get current game state
  getGameState() {
    return { ...this.state };
  }
}
