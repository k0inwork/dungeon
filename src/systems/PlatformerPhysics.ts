import { MEMORY } from "../constants/Memory";

export interface PlatformerConfig {
  gravity: number;
  jump_force: number;
  wall_color: number;
}

export class PlatformerPhysics {
  x: number = 2;
  y: number = 2;
  vx: number = 0;
  vy: number = 0;
  
  // Configurable Properties
  gravity: number = 0.5;
  jumpForce: number = -1.2;
  wallColor: number = 0xFF555555;
  
  // Constants
  MOVE_SPEED: number = 0.5;
  FRICTION: number = 0.8;
  
  // Map Constraints
  WIDTH: number = MEMORY.GRID_WIDTH;
  HEIGHT: number = MEMORY.GRID_HEIGHT;
  GROUND_Y: number = 18;

  configure(config: PlatformerConfig) {
    this.gravity = config.gravity;
    this.jumpForce = config.jump_force;
    this.wallColor = config.wall_color;
  }

  update() {
    // Apply Gravity
    this.vy += this.gravity;
    
    // Apply Velocity
    this.x += this.vx;
    this.y += this.vy;
    
    // Friction
    this.vx *= this.FRICTION;

    // Floor Collision
    if (this.y >= this.GROUND_Y) {
      this.y = this.GROUND_Y;
      this.vy = 0;
    }

    // Wall Collision
    if (this.x < 0) this.x = 0;
    if (this.x >= this.WIDTH) this.x = this.WIDTH - 1;
  }

  jump() {
    if (this.y >= this.GROUND_Y - 0.1) {
      this.vy = this.jumpForce; 
    }
  }

  move(dir: number) {
    if (dir === -1) this.vx = -this.MOVE_SPEED;
    if (dir === 1) this.vx = this.MOVE_SPEED;
  }

  renderToBuffer(buffer: Uint32Array) {
    // Clear
    buffer.fill(0x00000000); 

    // Draw Floor
    const floorChar = 35; // '#'
    const packedFloor = (this.wallColor) | floorChar;
    
    for (let cx = 0; cx < this.WIDTH; cx++) {
        const idx = (this.GROUND_Y + 1) * this.WIDTH + cx;
        buffer[idx] = packedFloor;
    }

    // Draw Gateway
    const gateIdx = (this.GROUND_Y) * this.WIDTH + (this.WIDTH - 2);
    buffer[gateIdx] = 0x00FFFF00 | 60; // Cyan '<'

    // Draw Player
    const px = Math.floor(this.x);
    const py = Math.floor(this.y);
    
    if (px >= 0 && px < this.WIDTH && py >= 0 && py < this.HEIGHT) {
      const idx = py * this.WIDTH + px;
      buffer[idx] = 0xFFFFFFFF | 64; // White '@'
    }
  }
}
