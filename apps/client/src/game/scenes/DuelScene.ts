import Phaser from 'phaser';

const LANE_COUNT = 3;
const LANE_WIDTH = 100;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const PLAYER_SIZE = 30;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_HEIGHT = 40;

const INITIAL_SPEED = 200;
const MAX_SPEED = 600;
const SPEED_INCREMENT = 5;
const OBSTACLE_SPAWN_INTERVAL = 1500;

// Duel-specific constants
const DUEL_DURATION_MS = 30000; // 30 seconds

interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  distance: number;
  speed: number;
  currentLane: number;
  startTime: number;
  timeRemaining: number;
}

export class DuelScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Graphics;
  private obstacles!: Phaser.GameObjects.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private state!: GameState;
  private lanePositions: number[] = [];
  private obstacleTimer?: Phaser.Time.TimerEvent;
  private distanceText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private lastLaneChange = 0;
  private touchStartX = 0;
  private autoStartTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'DuelScene' });
  }

  create() {
    this.state = {
      isPlaying: false,
      isGameOver: false,
      distance: 0,
      speed: INITIAL_SPEED,
      currentLane: 1,
      startTime: 0,
      timeRemaining: DUEL_DURATION_MS / 1000,
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
    this.scheduleAutoStart();
  }

  private createBackground() {
    const bg = this.add.graphics();
    // Slightly different color for duel mode (more purple/pink tint)
    bg.fillGradientStyle(0x1a0b20, 0x1a0b20, 0x2a1433, 0x2a1433);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createLanes() {
    const startX = (GAME_WIDTH - LANE_COUNT * LANE_WIDTH) / 2;
    const laneGraphics = this.add.graphics();

    // Lane borders (pink for duel mode)
    laneGraphics.lineStyle(2, 0xff6eb4, 0.3);
    for (let i = 0; i <= LANE_COUNT; i++) {
      const x = startX + i * LANE_WIDTH;
      laneGraphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    // Lane markers
    laneGraphics.lineStyle(1, 0xff6eb4, 0.1);
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
    // Pink player for duel mode
    this.player.fillStyle(0xff6eb4, 1);
    this.player.fillTriangle(x, y - PLAYER_SIZE, x - PLAYER_SIZE / 2, y + PLAYER_SIZE / 2, x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2);

    // Engine glow
    this.player.fillStyle(0xff4a6e, 0.8);
    this.player.fillCircle(x, y + PLAYER_SIZE / 2 + 5, 8);
  }

  private createUI() {
    // Title
    this.add
      .text(GAME_WIDTH / 2, 25, 'GHOST-WHEEL DUEL', {
        font: 'bold 24px monospace',
        color: '#ff6eb4',
      })
      .setOrigin(0.5);

    // Timer (prominent)
    this.timerText = this.add
      .text(GAME_WIDTH / 2, 55, '30', {
        font: 'bold 32px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Stats
    this.distanceText = this.add.text(20, 90, 'Distance: 0 m', {
      font: '16px monospace',
      color: '#ffffff',
    });

    this.speedText = this.add.text(20, 115, 'Speed: 200 km/h', {
      font: '16px monospace',
      color: '#ffffff',
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
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Space to start
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (!this.state.isPlaying && !this.state.isGameOver) {
        this.autoStartTimer?.destroy();
        this.autoStartTimer = undefined;
        this.startGame();
      } else if (this.state.isGameOver) {
        this.restartGame();
      }
    });

    // Touch input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.touchStartX = pointer.x;

      if (!this.state.isPlaying && !this.state.isGameOver) {
        this.autoStartTimer?.destroy();
        this.autoStartTimer = undefined;
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
    this.statusText.setText('30-Second Race!\n\nAuto-starting...\n\nLEFT/RIGHT or Swipe to Move');
  }

  private scheduleAutoStart() {
    this.autoStartTimer?.destroy();
    this.autoStartTimer = this.time.delayedCall(800, () => {
      if (!this.state.isPlaying && !this.state.isGameOver) {
        this.startGame();
      }
    });
  }

  private startGame() {
    if (this.state.isPlaying) return;
    this.state.isPlaying = true;
    this.state.startTime = Date.now();
    this.statusText.setText('');

    // Start spawning obstacles
    this.obstacleTimer = this.time.addEvent({
      delay: OBSTACLE_SPAWN_INTERVAL,
      callback: () => this.spawnObstacle(),
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

  override update(_time: number, delta: number) {
    if (!this.state.isPlaying) return;

    const elapsed = Date.now() - this.state.startTime;
    this.state.timeRemaining = Math.max(0, (DUEL_DURATION_MS - elapsed) / 1000);

    // Check if time is up
    if (elapsed >= DUEL_DURATION_MS) {
      this.endRace();
      return;
    }

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

      // Check collision (in duel mode, collision slows you down instead of game over)
      if (this.checkCollision(obstacle)) {
        this.handleCollision(obstacle);
      }

      // Remove off-screen obstacles
      if (obstacle.y > GAME_HEIGHT + OBSTACLE_HEIGHT) {
        obstacle.destroy();
      }
    });

    // Update UI
    this.distanceText.setText(`Distance: ${Math.floor(this.state.distance)} m`);
    this.speedText.setText(`Speed: ${Math.floor(this.state.speed)} km/h`);
    this.timerText.setText(Math.ceil(this.state.timeRemaining).toString());

    // Timer color change
    if (this.state.timeRemaining <= 5) {
      this.timerText.setColor('#ff4444');
    } else if (this.state.timeRemaining <= 10) {
      this.timerText.setColor('#ffaa44');
    }
  }

  private checkCollision(obstacle: Phaser.GameObjects.Graphics): boolean {
    const obstacleLane = (obstacle as unknown as { lane: number; hit?: boolean }).lane;
    if (obstacleLane !== this.state.currentLane) return false;
    if ((obstacle as unknown as { hit?: boolean }).hit) return false;

    const playerY = GAME_HEIGHT - 80;
    const playerTop = playerY - PLAYER_SIZE;
    const playerBottom = playerY + PLAYER_SIZE / 2;

    const obstacleTop = obstacle.y - OBSTACLE_HEIGHT / 2;
    const obstacleBottom = obstacle.y + OBSTACLE_HEIGHT / 2;

    return obstacleBottom > playerTop && obstacleTop < playerBottom;
  }

  private handleCollision(obstacle: Phaser.GameObjects.Graphics) {
    // Mark as hit to prevent multiple hits
    (obstacle as unknown as { hit: boolean }).hit = true;

    // Slow down on collision (penalty)
    this.state.speed = Math.max(INITIAL_SPEED, this.state.speed - 100);

    // Visual feedback
    const x = this.lanePositions[this.state.currentLane];
    if (x === undefined) return;
    const y = GAME_HEIGHT - 80;

    const flash = this.add.graphics();
    flash.fillStyle(0xff0000, 0.3);
    flash.fillCircle(x, y, 50);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  private endRace() {
    this.state.isPlaying = false;
    this.state.isGameOver = true;

    this.obstacleTimer?.destroy();

    this.statusText.setText(
      `TIME'S UP!\n\nYour Distance: ${Math.floor(this.state.distance)} m\n\nWaiting for opponent...`
    );

    // Emit race end event
    this.events.emit('raceEnd', {
      distance: Math.floor(this.state.distance),
      time: DUEL_DURATION_MS / 1000,
    });
  }

  private restartGame() {
    this.state = {
      isPlaying: false,
      isGameOver: false,
      distance: 0,
      speed: INITIAL_SPEED,
      currentLane: 1,
      startTime: 0,
      timeRemaining: DUEL_DURATION_MS / 1000,
    };

    this.obstacles.clear(true, true);
    this.drawPlayer();
    this.timerText.setColor('#ffffff');
    this.timerText.setText('30');
    this.showStartPrompt();
    this.scheduleAutoStart();
  }

  // Public method to get current game state
  getGameState() {
    return { ...this.state };
  }

  // Public method to show result
  showResult(result: { winner: string; playerAScore: number; playerBScore: number; myPlayer: string }) {
    const isWinner = result.winner === result.myPlayer;
    const isDraw = result.winner === 'draw';

    let message: string;
    if (isDraw) {
      message = `IT'S A DRAW!\n\nYou: ${result.myPlayer === 'A' ? result.playerAScore : result.playerBScore} m\nOpponent: ${result.myPlayer === 'A' ? result.playerBScore : result.playerAScore} m`;
    } else if (isWinner) {
      message = `YOU WIN!\n\nYou: ${result.myPlayer === 'A' ? result.playerAScore : result.playerBScore} m\nOpponent: ${result.myPlayer === 'A' ? result.playerBScore : result.playerAScore} m`;
    } else {
      message = `YOU LOSE\n\nYou: ${result.myPlayer === 'A' ? result.playerAScore : result.playerBScore} m\nOpponent: ${result.myPlayer === 'A' ? result.playerBScore : result.playerAScore} m`;
    }

    this.statusText.setText(message + '\n\nPress SPACE to continue');
    this.statusText.setColor(isDraw ? '#ffaa44' : isWinner ? '#00ff88' : '#ff4444');
  }
}
