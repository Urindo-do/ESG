import { ACTIONS, actionById } from './actions.js';
import { findPath, groundHeight } from './navigation.js';

export class BehaviorController {
  constructor(danbi, furniture, onChange) {
    this.danbi = danbi; this.furniture = furniture; this.onChange = onChange;
    this.automatic = true; this.paused = false; this.elapsed = 0; this.time = 0;
    this.action = null; this.path = []; this.runIndex = 0;
    this.select('shake');
  }
  get state() { return { action: this.action, walking: this.path.length > 0, automatic: this.automatic, paused: this.paused }; }
  emit() { this.onChange?.(this.state); }
  select(id) {
    if (!actionById[id]) return;
    this.resetProps(); this.action = actionById[id]; this.elapsed = 0; this.runIndex = 0;
    const p = this.danbi.root.position;
    this.path = findPath([p.x, p.z], this.action.target, this.furniture.obstacles);
    // Selecting a new action intentionally resumes a paused character.
    this.paused = false; this.emit();
  }
  resetProps() {
    this.furniture.ball.position.copy(this.furniture.ballHome);
    this.furniture.toy.position.y = 0.38;
  }
  setAutomatic(value) { this.automatic = value; this.emit(); }
  togglePause() {
    if (this.paused && this.elapsed >= this.action.duration) { this.select(this.action.id); return; }
    this.paused = !this.paused; this.emit();
  }
  turnToward(x, z, dt) {
    const root = this.danbi.root, target = Math.atan2(x - root.position.x, z - root.position.z);
    const difference = Math.atan2(Math.sin(target - root.rotation.y), Math.cos(target - root.rotation.y));
    root.rotation.y += difference * Math.min(1, dt * 10);
  }
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    const p = this.danbi.root.position;
    let walking = this.path.length > 0;
    if (walking) {
      if (this.action.id === 'run') this.elapsed += dt;
      const [x, z] = this.path[0], dx = x - p.x, dz = z - p.z, distance = Math.hypot(dx, dz);
      const step = dt * (this.action.id === 'run' ? 1.75 : 1.05);
      this.turnToward(x, z, dt);
      if (distance <= step) { p.x = x; p.z = z; this.path.shift(); }
      else { p.x += dx / distance * step; p.z += dz / distance * step; }
      p.y = groundHeight(p.z);
      if (!this.path.length) { walking = false; this.emit(); }
    } else {
      this.elapsed += dt;
      this.turnToward(...this.action.face, dt);
      const mode = this.action.id;
      if (mode === 'play') {
        const ball = this.furniture.ball, home = this.furniture.ballHome;
        ball.position.x = home.x + Math.sin(this.elapsed * 2) * 0.32;
        ball.position.y = home.y + Math.abs(Math.sin(this.elapsed * 3)) * 0.32;
        ball.rotation.x = this.elapsed * 2;
      }
      if (mode === 'tidy') this.furniture.toy.position.y = 0.38 + Math.max(0, Math.sin(this.elapsed * 2.2)) * 0.20;
      if (mode === 'run' && this.elapsed < this.action.duration) {
        const loop = [[-2.5, 2.7], [-0.8, 3.15], [1.1, 2.5], [0, 1.9]];
        this.path = findPath([p.x, p.z], loop[this.runIndex++ % loop.length], this.furniture.obstacles);
        this.emit();
      }
      if (this.elapsed >= this.action.duration) {
        if (this.automatic) {
          const next = ACTIONS.filter(a => a.id !== mode);
          this.select(next[Math.floor(Math.random() * next.length)].id);
        } else {
          this.resetProps(); this.paused = true; this.emit();
        }
      }
    }
    this.danbi.animate(this.time, this.action.id, walking);
  }
}
