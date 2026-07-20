/** Particle FX, screen shake, starfield, nebula, neon trails */

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

  debris(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
        color,
        glow: true,
        type: 'debris',
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  ring(x, y, color, radius = 20) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size: radius,
      color,
      glow: true,
      type: 'ring',
    });
  }

  shockwave(x, y, color = '#00f0ff') {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.55,
      maxLife: 0.55,
      size: 10,
      color,
      glow: true,
      type: 'shock',
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

  afterimage(x, y, w, h, color = 'rgba(0,240,255,0.35)') {
    this.particles.push({
      x,
      y,
      w,
      h,
      vx: 0,
      vy: 0,
      life: 0.18,
      maxLife: 0.18,
      size: 1,
      color,
      glow: false,
      type: 'ghost',
    });
  }

  textPopup(x, y, text, color = '#b8ff3c') {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -32,
      life: 0.85,
      maxLife: 0.85,
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
      if (p.type === 'spark' || p.type === 'debris') {
        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.type === 'debris') p.rot = (p.rot || 0) + (p.spin || 0) * dt;
      } else if (p.type === 'text') {
        p.y += p.vy * dt;
      } else if (p.type === 'ring' || p.type === 'shock') {
        p.size += (p.type === 'shock' ? 420 : 90) * dt;
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      if (p.type === 'ring' || p.type === 'shock') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.type === 'shock' ? 4 + t * 4 : 2 + t * 3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'shock' ? 24 : 16;
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
      } else if (p.type === 'ghost') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.45;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w, p.y + p.h / 2);
        ctx.lineTo(p.x + 8, p.y);
        ctx.lineTo(p.x, p.y + 4);
        ctx.lineTo(p.x, p.y + p.h - 4);
        ctx.lineTo(p.x + 8, p.y + p.h);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'debris') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
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
  constructor(w, h, count = 110) {
    this.w = w;
    this.h = h;
    this.stars = Array.from({ length: count }, () => this._spawn(true));
    this.nebulae = Array.from({ length: 5 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 80 + Math.random() * 140,
      vx: -(8 + Math.random() * 18),
      color:
        Math.random() > 0.5
          ? 'rgba(0, 120, 180, 0.07)'
          : Math.random() > 0.5
            ? 'rgba(140, 40, 180, 0.06)'
            : 'rgba(255, 40, 140, 0.05)',
    }));
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
    for (const n of this.nebulae) {
      n.x += n.vx * dt * speedMul;
      if (n.x + n.r < 0) {
        n.x = this.w + n.r;
        n.y = Math.random() * this.h;
      }
    }
  }

  draw(ctx) {
    for (const n of this.nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.twinkle));
      ctx.fillStyle = `rgba(180, 230, 255, ${a})`;
      ctx.fillRect(s.x, s.y, s.size * s.z, s.size * s.z);
      if (s.z > 1.2) {
        ctx.fillStyle = `rgba(0, 240, 255, ${a * 0.35})`;
        ctx.fillRect(s.x - s.z * 2, s.y + s.size * 0.3, s.z * 4, 1);
      }
    }
  }
}

export class ScreenShake {
  constructor() {
    this.mag = 0;
    this.decay = 8;
  }

  add(amount) {
    this.mag = Math.min(16, this.mag + amount);
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
