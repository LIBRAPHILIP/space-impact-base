import { getLevel } from './levels.js';
import { ParticleSystem, Starfield, ScreenShake, FloatingOrbs } from './effects.js';
import {
  Player,
  createEnemy,
  createBoss,
  updateEnemy,
  drawEnemy,
  createPowerup,
  drawPowerup,
  rectsOverlap,
} from './entities.js';

const W = 960;
const H = 540;

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.particles = new ParticleSystem();
    this.stars = new Starfield(W, H, 110);
    this.shake = new ScreenShake();
    this.orbs = new FloatingOrbs(W, H);
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      boost: false,
      pointerTarget: null,
    };
    this.state = 'menu';
    this.level = 1;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.spawnTimer = 0;
    this.waveKills = 0;
    this.waveQuota = 8;
    this.bossActive = false;
    this.levelCfg = getLevel(1);
    this.lastTs = 0;
    this.raf = 0;
    this.flash = 0;
    this.introTimer = 0;
    this._bindInput();
  }

  _sfx(name) {
    this.hooks.onSfx?.(name);
  }

  _bindInput() {
    const map = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      Space: 'fire',
      ShiftLeft: 'boost',
      ShiftRight: 'boost',
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      const k = map[e.code];
      if (k) {
        e.preventDefault();
        this.input[k] = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = map[e.code];
      if (k) this.input[k] = false;
    });

    const toGame = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H,
      };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      this.canvas.setPointerCapture(e.pointerId);
      this.input.fire = true;
      this.input.pointerTarget = toGame(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.state !== 'playing' || !this.input.pointerTarget) return;
      this.input.pointerTarget = toGame(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('pointerup', () => {
      this.input.fire = false;
      this.input.pointerTarget = null;
    });
  }

  start(level = 1) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.level = level;
    this.levelCfg = getLevel(level);
    this.wave = 1;
    this.score = level === 1 ? 0 : this.score;
    if (level === 1) {
      this.kills = 0;
      this.score = 0;
    }
    this.combo = 1;
    this.comboTimer = 0;
    this.player = new Player(80, H / 2 - 11);
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.particles = new ParticleSystem();
    this.spawnTimer = 0.5;
    this.waveKills = 0;
    this.waveQuota = 6 + level * 2;
    this.bossActive = false;
    this.flash = 0;
    this.introTimer = 2.2;
    this.state = 'playing';
    this.hooks.onState?.(this.state);
    this.hooks.onHud?.(this._hud());
    this._loop(performance.now());
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hooks.onState?.(this.state);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.lastTs = performance.now();
    this.hooks.onState?.(this.state);
    this._loop(this.lastTs);
  }

  goMenu() {
    this.state = 'menu';
    this.hooks.onState?.(this.state);
  }

  _hud() {
    return {
      score: this.score,
      level: this.level,
      lives: this.player?.lives ?? 0,
      shield: this.player?.shield ?? 0,
      weapon: (this.player?.weapon || 'pulse').toUpperCase(),
      wave: this.wave,
      waves: this.levelCfg.waves,
      kills: this.kills,
      combo: this.combo,
      levelName: this.levelCfg.name,
    };
  }

  _spawnWaveEnemy() {
    const types = ['scout', 'scout', 'zigzag', 'drone', 'tank'];
    const weights = this.level < 3 ? [0.45, 0.2, 0.2, 0.1, 0.05] : [0.25, 0.15, 0.25, 0.2, 0.15];
    let r = Math.random();
    let type = 'scout';
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        type = types[i];
        break;
      }
    }
    const y = 30 + Math.random() * (H - 80);
    if (type === 'drone') {
      const baseY = y;
      for (let i = 0; i < 3; i++) {
        this.enemies.push(createEnemy('drone', W + 20 + i * 28, baseY + i * 16 - 16, this.levelCfg));
      }
    } else {
      this.enemies.push(createEnemy(type, W + 20, y, this.levelCfg));
    }
  }

  _startBoss() {
    this.bossActive = true;
    this.enemies.push(createBoss(this.levelCfg, W, H, this.player));
    this.particles.ring(W - 100, H / 2, '#ff2bd6', 40);
    this.particles.burst(W - 80, H / 2, '#ff2bd6', 30, 5, 0.8);
    this.shake.add(10);
    this._sfx('bossWarn');
    this.hooks.onBanner?.(`BOSS — ${this.levelCfg.bossName || 'THREAT'}`);
  }

  _clearLevel() {
    this.state = 'levelclear';
    this._sfx('levelClear');
    this.hooks.onState?.(this.state);
    this.hooks.onLevelClear?.({
      level: this.level,
      score: this.score,
      kills: this.kills,
      name: this.levelCfg.name,
      badgeName: this.levelCfg.badgeName,
    });
  }

  _gameOver() {
    this.state = 'gameover';
    this.particles.burst(this.player.x + 18, this.player.y + 11, '#ff3b6b', 40, 5, 0.9);
    this.shake.add(12);
    this._sfx('gameOver');
    this.hooks.onState?.(this.state);
    this.hooks.onGameOver?.({ score: this.score, level: this.level, kills: this.kills });
  }

  _loop(ts) {
    if (this.state !== 'playing') {
      this._draw();
      return;
    }
    const dt = Math.min(0.033, (ts - (this.lastTs || ts)) / 1000);
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    this.raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    this.stars.update(dt, 1 + this.level * 0.08 + (this.bossActive ? 0.35 : 0));
    this.orbs.update(dt);
    this.particles.update(dt);
    this.shake.update(dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    if (this.introTimer > 0) {
      this.introTimer -= dt;
    }

    this.player.boost = this.input.boost;
    this.player.update(dt, this.input, H);
    if (this.input.fire) {
      const fired = this.player.tryFire(this.bullets);
      if (fired) this._sfx(fired === 'rail' ? 'rail' : 'shoot');
    }

    if (Math.random() < 0.7) {
      this.particles.trail(this.player.x, this.player.y + this.player.h / 2, '#00f0ff', -3);
    }

    if (!this.bossActive && this.introTimer <= 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.waveKills < this.waveQuota) {
        this._spawnWaveEnemy();
        this.spawnTimer = this.levelCfg.spawnRate * (0.75 + Math.random() * 0.5);
      }
    }

    // enemies (boss returns phase / minion spawn info)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const info = updateEnemy(e, dt, H, this.bullets, this.player);
      if (info?.phaseChanged) {
        this._sfx('phase');
        this.shake.add(6);
        this.particles.ring(e.x + e.w / 2, e.y + e.h / 2, '#ff8a3d', 24);
        this.hooks.onBanner?.(
          info.phaseChanged === 3 ? '⚠ ENRAGE PROTOCOL' : `PHASE ${info.phaseChanged}`
        );
      }
      if (info?.spawned?.length) {
        for (const m of info.spawned) this.enemies.push(m);
      }
      if (e.x + e.w < -40 && e.type !== 'boss') {
        this.enemies.splice(i, 1);
        continue;
      }
      // boss dash can go left — clamp back later via dash end
      if (e.type === 'boss' && e.x + e.w < 0) {
        e.x = 40;
        e.dashTimer = 0;
      }
      if (this.player.alive && rectsOverlap(this.player.bounds(), e)) {
        const res = this.player.hit();
        if (res) {
          this.particles.burst(this.player.x, this.player.y, '#ff3b6b', 18, 4);
          this.shake.add(res === 'hull' ? 8 : 4);
          this.flash = 0.12;
          this._sfx('damage');
          if (e.type !== 'boss') {
            this.enemies.splice(i, 1);
            this.particles.burst(e.x, e.y, e.color, 12);
            this._sfx('explosion');
          }
          if (!this.player.alive) {
            this._gameOver();
            return;
          }
        }
      }
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > W + 60 || b.y < -40 || b.y > H + 40) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.fromPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (rectsOverlap(b, e)) {
            e.hp -= b.dmg;
            this.bullets.splice(i, 1);
            this.particles.burst(b.x, b.y, b.color, 6, 2, 0.25);
            this._sfx('hit');
            if (e.hp <= 0) {
              this.score += Math.floor(e.score * this.combo);
              this.kills += 1;
              this.waveKills += 1;
              this.combo = Math.min(9, this.combo + 1);
              this.comboTimer = 2.2;
              const isBoss = e.type === 'boss';
              this.particles.burst(
                e.x + e.w / 2,
                e.y + e.h / 2,
                e.color,
                isBoss ? 60 : 18,
                isBoss ? 6 : 4.5,
                0.7
              );
              this.particles.ring(e.x + e.w / 2, e.y + e.h / 2, e.color, isBoss ? 28 : 12);
              this.particles.textPopup(e.x, e.y, `+${Math.floor(e.score * this.combo)}`);
              this.shake.add(isBoss ? 14 : 3);
              this._sfx(isBoss ? 'bossExplosion' : 'explosion');
              if (Math.random() < (isBoss ? 1 : 0.18)) {
                this.powerups.push(createPowerup(e.x, e.y));
              }
              this.enemies.splice(j, 1);
              if (isBoss) {
                this.bossActive = false;
                this._clearLevel();
                return;
              }
            }
            break;
          }
        }
      } else if (this.player.alive && rectsOverlap(b, this.player.bounds())) {
        this.bullets.splice(i, 1);
        const res = this.player.hit();
        if (res) {
          this.particles.burst(this.player.x, this.player.y, '#ff8a3d', 14);
          this.shake.add(5);
          this.flash = 0.1;
          this._sfx('damage');
          if (!this.player.alive) {
            this._gameOver();
            return;
          }
        }
      }
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.x -= 40 * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < -30) {
        this.powerups.splice(i, 1);
        continue;
      }
      if (this.player.alive && rectsOverlap(this.player.bounds(), p)) {
        this._applyPowerup(p.type);
        this.particles.burst(p.x, p.y, p.color, 16, 3, 0.4);
        this.particles.textPopup(p.x, p.y - 10, p.type.toUpperCase(), p.color);
        this._sfx('powerup');
        this.powerups.splice(i, 1);
      }
    }

    if (!this.bossActive && this.state === 'playing' && this.introTimer <= 0) {
      // only count non-minion leftovers: wave complete when quota met and no non-boss enemies
      const hostiles = this.enemies.filter((en) => en.type !== 'boss');
      if (this.waveKills >= this.waveQuota && hostiles.length === 0) {
        if (this.wave >= this.levelCfg.waves) {
          if (this.levelCfg.boss) {
            this._startBoss();
          } else {
            this._clearLevel();
            return;
          }
        } else {
          this.wave += 1;
          this.waveKills = 0;
          this.waveQuota = 6 + this.level * 2 + this.wave;
          this.spawnTimer = 1.1;
          this._sfx('wave');
          this.hooks.onBanner?.(`WAVE ${this.wave}`);
        }
      }
    }

    this.hooks.onHud?.(this._hud());
  }

  _applyPowerup(type) {
    if (type === 'heal') {
      this.player.lives = Math.min(5, this.player.lives + 1);
    } else if (type === 'shield') {
      this.player.shield = 1;
      this.player.invuln = Math.max(this.player.invuln, 1.2);
    } else if (type === 'twin' || type === 'spread' || type === 'rail') {
      this.player.weapon = type;
      this.player.weaponTimer = 12;
    }
  }

  _draw() {
    const ctx = this.ctx;
    const off = this.shake.offset();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05061a');
    bg.addColorStop(0.5, '#0a0d24');
    bg.addColorStop(1, this.bossActive ? '#1a0820' : '#12081f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.translate(off.x, off.y);
    this.orbs.draw(ctx);
    this.stars.draw(ctx);

    ctx.strokeStyle = this.bossActive ? 'rgba(255, 43, 214, 0.08)' : 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    const t = performance.now() * 0.02;
    for (let i = 0; i < 12; i++) {
      const y = ((i * 50 + t) % (H + 50)) - 25;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (const b of this.bullets) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      if (b.fromPlayer) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
      } else {
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const e of this.enemies) drawEnemy(ctx, e);
    for (const p of this.powerups) drawPowerup(ctx, p);
    if (this.player) this.player.draw(ctx);
    this.particles.draw(ctx);

    if (this.state === 'playing' && this.introTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.introTimer);
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 28px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;
      ctx.fillText(`SECTOR ${this.level}`, W / 2, H / 2 - 12);
      ctx.font = '16px Orbitron, sans-serif';
      ctx.fillStyle = '#ff2bd6';
      ctx.fillText(this.levelCfg.name, W / 2, H / 2 + 18);
      ctx.restore();
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 80, ${this.flash * 1.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.strokeStyle = this.bossActive ? 'rgba(255, 43, 214, 0.35)' : 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    ctx.restore();
  }
}
