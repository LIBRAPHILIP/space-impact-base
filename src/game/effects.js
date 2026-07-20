/** Particle FX, screen shake, starfield, neon trails */

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  burst(x, y, color, count = 14, speed = 3.5, life = 0.55) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const s = speed * (0.4 + Math.random() * 0.9);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: 1.5 + Math.random() * 3,
        color,
        glow: true,
        type: 'spark',
      });
    }
  }

  ring(x, y, color, radius = 20) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.4,
      maxLife: 0.4,
      size: radius,
      color,
      glow: true,
      type: 'ring',
    });
  }

  trail(x, y, color, vx = -2) {
    this.particles.push({
      x,
      y: y + (Math.random() - 0.5) * 6,
      vx: vx + (Math.random() - 0.5),
      vy: (Math.random() - 0.5) * 0.8,
      life: 0.25 + Math.random() * 0.2,
      maxLife: 0.4,
      size: 2 + Math.random() * 2,
      color,
      glow: true,
      type: 'spark',
    });
  }

  textPopup(x, y, text, color = '#b8ff3c') {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -28,
      life: 0.8,
      maxLife: 0.8,
      size: 14,
      color,
      glow: false,
      type: 'text',
      text,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.type === 'spark') {
        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
      } else if (p.type === 'text') {
        p.y += p.vy * dt;
      } else if (p.type === 'ring') {
        p.size += 80 * dt;
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + t * 3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 14px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glow ? 12 : 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

export class Starfield {
  constructor(w, h, count = 90) {
    this.w = w;
    this.h = h;
    this.stars = Array.from({ length: count }, () => this._spawn(true));
  }

  _spawn(full = false) {
    return {
      x: full ? Math.random() * this.w : this.w + Math.random() * 40,
      y: Math.random() * this.h,
      z: 0.3 + Math.random() * 1.4,
      size: Math.random() < 0.12 ? 2.2 : 1 + Math.random(),
      twinkle: Math.random() * Math.PI * 2,
    };
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  update(dt, speedMul = 1) {
    for (const s of this.stars) {
      s.x -= (40 + s.z * 90) * dt * speedMul;
      s.twinkle += dt * 4;
      if (s.x < -4) Object.assign(s, this._spawn(false), { y: Math.random() * this.h });
    }
  }

  draw(ctx) {
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.twinkle));
      ctx.fillStyle = `rgba(180, 230, 255, ${a})`;
      ctx.fillRect(s.x, s.y, s.size * s.z, s.size * s.z);
    }
  }
}

export class ScreenShake {
  constructor() {
    this.mag = 0;
    this.decay = 8;
  }

  add(amount) {
    this.mag = Math.min(14, this.mag + amount);
  }

  update(dt) {
    this.mag = Math.max(0, this.mag - this.decay * dt * this.mag);
  }

  offset() {
    if (this.mag < 0.1) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.mag * 2,
      y: (Math.random() - 0.5) * this.mag * 2,
    };
  }
}

export class FloatingOrbs {
  constructor(w, h) {
    this.orbs = Array.from({ length: 8 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 40 + Math.random() * 80,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 8,
      color: Math.random() > 0.5 ? 'rgba(0,240,255,0.04)' : 'rgba(255,43,214,0.035)',
    }));
    this.w = w;
    this.h = h;
  }

  update(dt) {
    for (const o of this.orbs) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < -o.r) o.x = this.w + o.r;
      if (o.x > this.w + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = this.h + o.r;
      if (o.y > this.h + o.r) o.y = -o.r;
    }
  }

  draw(ctx) {
    for (const o of this.orbs) {
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, o.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
