/** Ships, bullets, enemies, powerups, boss, asteroids */

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { rectsOverlap };

export class Player {
  constructor(x, y, lives = 3) {
    this.x = x;
    this.y = y;
    this.w = 38;
    this.h = 22;
    this.speed = 300;
    this.boost = false;
    this.lives = lives;
    this.shield = 1;
    this.invuln = 0;
    this.fireCd = 0;
    this.weapon = 'pulse';
    this.weaponTimer = 0;
    this.alive = true;
    this.enginePhase = 0;
    this.magnet = 0;
    this.overdrive = 0;
    this.bombs = 2;
    this.maxBombs = 3;
    this.moving = false;
  }

  bounds() {
    return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 };
  }

  hit() {
    if (this.invuln > 0) return false;
    if (this.overdrive > 0) {
      this.invuln = 0.4;
      return 'shield';
    }
    if (this.shield > 0.35) {
      this.shield = Math.max(0, this.shield - 0.45);
      this.invuln = 0.85;
      return 'shield';
    }
    this.lives -= 1;
    this.shield = 1;
    this.invuln = 1.7;
    this.weapon = 'pulse';
    this.weaponTimer = 0;
    if (this.lives <= 0) this.alive = false;
    return 'hull';
  }

  update(dt, input, worldH) {
    this.enginePhase += dt * 18;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.magnet > 0) this.magnet -= dt;
    if (this.overdrive > 0) this.overdrive -= dt;
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) this.weapon = 'pulse';
    }
    if (this.fireCd > 0) this.fireCd -= dt;

    if (!this.boost) {
      this.shield = Math.min(1, this.shield + dt * 0.14);
    } else {
      this.shield = Math.max(0, this.shield - dt * 0.16);
    }

    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }

    if (input.pointerTarget) {
      const tx = input.pointerTarget.x - this.w / 2;
      const ty = input.pointerTarget.y - this.h / 2;
      const px = tx - this.x;
      const py = ty - this.y;
      const dist = Math.hypot(px, py);
      if (dist > 4) {
        dx = px / dist;
        dy = py / dist;
      }
    }

    this.moving = Boolean(dx || dy);
    const boostMul = this.boost && this.shield > 0.05 ? 1.6 : 1;
    const odMul = this.overdrive > 0 ? 1.2 : 1;
    const spd = this.speed * boostMul * odMul;
    this.x += dx * spd * dt;
    this.y += dy * spd * dt;
    this.x = Math.max(8, Math.min(this.x, 440));
    this.y = Math.max(8, Math.min(this.y, worldH - this.h - 8));
  }

  tryFire(bullets) {
    if (this.fireCd > 0 || !this.alive) return null;
    const cx = this.x + this.w;
    const cy = this.y + this.h / 2;
    const dmgMul = this.overdrive > 0 ? 1.5 : 1;
    const mk = (vx, vy, dmg = 1, color = '#00f0ff', w = 10, h = 3) => {
      bullets.push({
        x: cx,
        y: cy - h / 2,
        w,
        h,
        vx: vx * (this.overdrive > 0 ? 1.15 : 1),
        vy,
        dmg: dmg * dmgMul,
        color,
        fromPlayer: true,
        life: 2,
      });
    };

    const weapon = this.weapon;
    if (weapon === 'twin') {
      mk(540, 0, 1, '#00f0ff');
      mk(540, 0, 1, '#00f0ff');
      bullets[bullets.length - 1].y -= 8;
      bullets[bullets.length - 2].y += 6;
      this.fireCd = 0.12;
    } else if (weapon === 'spread') {
      mk(500, -140, 1, '#b8ff3c');
      mk(540, 0, 1, '#b8ff3c');
      mk(500, 140, 1, '#b8ff3c');
      if (this.overdrive > 0) {
        mk(480, -80, 1, '#b8ff3c');
        mk(480, 80, 1, '#b8ff3c');
      }
      this.fireCd = 0.18;
    } else if (weapon === 'rail') {
      mk(820, 0, 3.5, '#ff2bd6', 20, 4);
      this.fireCd = 0.28;
    } else if (weapon === 'plasma') {
      mk(480, -40, 1.5, '#8b5cff', 12, 8);
      mk(480, 40, 1.5, '#8b5cff', 12, 8);
      mk(560, 0, 2, '#c4a0ff', 14, 6);
      this.fireCd = 0.16;
    } else {
      mk(580, 0, 1, '#00f0ff');
      if (this.overdrive > 0) {
        mk(520, -50, 1, '#00f0ff');
        mk(520, 50, 1, '#00f0ff');
      }
      this.fireCd = 0.14;
    }
    return weapon;
  }

  draw(ctx) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0;
    if (blink) return;

    const x = this.x;
    const y = this.y;
    ctx.save();

    const pulse = 0.5 + 0.5 * Math.sin(this.enginePhase);
    const thruster = this.boost ? 1.4 : 1;

    // shield bubble
    if (this.shield > 0.2 || this.overdrive > 0) {
      ctx.strokeStyle =
        this.overdrive > 0
          ? `rgba(255, 43, 214, ${0.25 + pulse * 0.3})`
          : `rgba(0, 240, 255, ${0.15 + this.shield * 0.25})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = this.overdrive > 0 ? '#ff2bd6' : '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, y + this.h / 2, this.w * 0.7, this.h * 0.95, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // engine
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16 + pulse * 12;
    ctx.fillStyle = `rgba(0, 240, 255, ${0.35 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + this.h / 2);
    ctx.lineTo(x - 12 - pulse * 10 * thruster, y + this.h / 2 - 6);
    ctx.lineTo(x - 12 - pulse * 10 * thruster, y + this.h / 2 + 6);
    ctx.closePath();
    ctx.fill();

    const grad = ctx.createLinearGradient(x, y, x + this.w, y);
    grad.addColorStop(0, '#0a2a3a');
    grad.addColorStop(0.35, this.overdrive > 0 ? '#ff6ad5' : '#00e0ff');
    grad.addColorStop(1, '#8b5cff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x + this.w, y + this.h / 2);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x, y + this.h - 4);
    ctx.lineTo(x + 10, y + this.h);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff2bd6';
    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(x + 16, y + this.h / 2 - 3, 11, 6);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b8ff3c';
    ctx.fillRect(x + 6, y + 1, 10, 2);
    ctx.fillRect(x + 6, y + this.h - 3, 10, 2);

    ctx.restore();
  }
}

export function createEnemy(type, x, y, levelCfg) {
  const speed = 80 * levelCfg.enemySpeed;
  const hpMul = levelCfg.enemyHp;

  if (type === 'scout') {
    return {
      type,
      x,
      y,
      w: 28,
      h: 18,
      hp: Math.ceil(1 * hpMul),
      maxHp: Math.ceil(1 * hpMul),
      vx: -speed * (0.9 + Math.random() * 0.3),
      vy: 0,
      score: 100,
      color: levelCfg.palette[0],
      fireCd: 1.2 + Math.random(),
      phase: Math.random() * Math.PI * 2,
      pattern: 'sine',
    };
  }
  if (type === 'tank') {
    return {
      type,
      x,
      y,
      w: 42,
      h: 28,
      hp: Math.ceil(5 * hpMul),
      maxHp: Math.ceil(5 * hpMul),
      vx: -speed * 0.5,
      vy: 0,
      score: 280,
      color: levelCfg.palette[1] || '#ff8a3d',
      fireCd: 1.6,
      phase: 0,
      pattern: 'straight',
    };
  }
  if (type === 'zigzag') {
    return {
      type,
      x,
      y,
      w: 26,
      h: 20,
      hp: Math.ceil(2 * hpMul),
      maxHp: Math.ceil(2 * hpMul),
      vx: -speed * 1.15,
      vy: 130,
      score: 160,
      color: '#ff2bd6',
      fireCd: 1.3,
      phase: Math.random() * Math.PI * 2,
      pattern: 'zigzag',
    };
  }
  if (type === 'sniper') {
    return {
      type,
      x,
      y,
      w: 30,
      h: 16,
      hp: Math.ceil(2 * hpMul),
      maxHp: Math.ceil(2 * hpMul),
      vx: -speed * 0.65,
      vy: 0,
      score: 220,
      color: '#ff8a3d',
      fireCd: 1.8,
      phase: 0,
      pattern: 'sniper',
    };
  }
  if (type === 'bomber') {
    return {
      type,
      x,
      y,
      w: 36,
      h: 24,
      hp: Math.ceil(3 * hpMul),
      maxHp: Math.ceil(3 * hpMul),
      vx: -speed * 0.75,
      vy: 0,
      score: 300,
      color: '#ff3b6b',
      fireCd: 2.2,
      phase: 0,
      pattern: 'bomber',
    };
  }
  return {
    type: 'drone',
    x,
    y,
    w: 18,
    h: 14,
    hp: Math.ceil(1 * hpMul),
    maxHp: Math.ceil(1 * hpMul),
    vx: -speed * 1.35,
    vy: 0,
    score: 80,
    color: '#b8ff3c',
    fireCd: 99,
    phase: Math.random() * 10,
    pattern: 'drone',
  };
}

export function createAsteroid(w, h, levelCfg) {
  const size = 18 + Math.random() * 28;
  return {
    type: 'asteroid',
    x: w + 20,
    y: 20 + Math.random() * (h - 60),
    w: size,
    h: size,
    hp: Math.ceil((2 + size / 16) * (levelCfg.enemyHp || 1)),
    maxHp: Math.ceil((2 + size / 16) * (levelCfg.enemyHp || 1)),
    vx: -(40 + Math.random() * 60) * (levelCfg.enemySpeed || 1),
    vy: (Math.random() - 0.5) * 40,
    score: 60,
    color: '#6a7a9a',
    fireCd: 99,
    phase: Math.random() * 10,
    pattern: 'asteroid',
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 2,
  };
}

export function createBoss(levelCfg, w, h) {
  const diff = levelCfg.bossDifficulty || (levelCfg.id >= 5 ? 3 : levelCfg.id >= 3 ? 2 : 1);
  const hpBase = 55 + diff * 35 + (levelCfg.id || 1) * 12;
  const hp = Math.ceil(hpBase * (levelCfg.enemyHp || 1));
  return {
    type: 'boss',
    name: levelCfg.bossName || 'BOSS',
    x: w + 40,
    y: h / 2 - 48,
    w: 100 + diff * 8,
    h: 88 + diff * 6,
    hp,
    maxHp: hp,
    vx: -20,
    vy: 70 + diff * 15,
    score: 4000 + diff * 2500,
    color: diff >= 3 ? '#ff2bd6' : diff >= 2 ? '#ff8a3d' : '#8b5cff',
    fireCd: 0.35,
    phase: 0,
    combatPhase: 1,
    pattern: 'boss',
    entered: false,
    difficulty: diff,
    dashCd: 3.5,
    dashTimer: 0,
    dashVx: 0,
    dashVy: 0,
    minionCd: 4,
    spiralAngle: 0,
    beamCd: 5,
    invulnFlash: 0,
    lastPhase: 1,
  };
}

function pushBullet(bullets, opts) {
  bullets.push({
    w: 8,
    h: 8,
    dmg: 1,
    life: 4,
    fromPlayer: false,
    ...opts,
  });
}

function aimedShot(bullets, from, target, speed, color, extra = {}) {
  const cx = from.x;
  const cy = from.y + from.h / 2;
  if (!target) {
    pushBullet(bullets, { x: cx, y: cy - 4, vx: -speed, vy: 0, color, ...extra });
    return;
  }
  const tx = target.x + target.w / 2;
  const ty = target.y + target.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  pushBullet(bullets, {
    x: cx,
    y: cy - 4,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    color,
    ...extra,
  });
}

export function updateBoss(e, dt, worldH, bullets, player) {
  const result = { phaseChanged: null, spawned: [] };
  e.phase += dt;
  if (e.invulnFlash > 0) e.invulnFlash -= dt;

  if (!e.entered) {
    e.x -= 140 * dt;
    if (e.x <= 760) {
      e.entered = true;
      e.x = 760;
    }
    return result;
  }

  const pct = e.hp / e.maxHp;
  const nextPhase = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (nextPhase !== e.combatPhase) {
    e.combatPhase = nextPhase;
    e.invulnFlash = 0.45;
    result.phaseChanged = nextPhase;
    e.vy = (e.vy > 0 ? 1 : -1) * (90 + e.difficulty * 25 + nextPhase * 20);
  }

  const speedMul = 1 + (e.combatPhase - 1) * 0.35 + e.difficulty * 0.08;
  if (e.dashTimer > 0) {
    e.dashTimer -= dt;
    e.x += e.dashVx * dt;
    e.y += e.dashVy * dt;
    if (e.dashTimer <= 0) e.x = Math.min(e.x, 800);
  } else {
    e.y += e.vy * dt * speedMul;
    if (e.combatPhase >= 2) e.x = 760 + Math.sin(e.phase * 1.8) * (18 + e.difficulty * 6);
    if (e.y < 16 || e.y + e.h > worldH - 16) {
      e.vy *= -1;
      e.y = Math.max(16, Math.min(e.y, worldH - e.h - 16));
    }
  }

  e.dashCd -= dt;
  if (e.combatPhase >= 2 && e.dashCd <= 0 && e.dashTimer <= 0 && player) {
    e.dashCd = 4.2 - e.difficulty * 0.4 - (e.combatPhase === 3 ? 0.8 : 0);
    e.dashTimer = 0.55;
    const ty = player.y + player.h / 2 - (e.y + e.h / 2);
    e.dashVx = -320 - e.difficulty * 40;
    e.dashVy = Math.max(-200, Math.min(200, ty * 2.2));
  }

  e.minionCd -= dt;
  if (e.combatPhase >= 2 && e.minionCd <= 0) {
    e.minionCd = 5.5 - e.difficulty * 0.5 - (e.combatPhase === 3 ? 1.2 : 0);
    const count = e.combatPhase === 3 ? 3 + e.difficulty : 2;
    for (let i = 0; i < count; i++) {
      result.spawned.push({
        type: 'drone',
        x: e.x - 10,
        y: e.y + (e.h / (count + 1)) * (i + 1),
        w: 18,
        h: 14,
        hp: 1 + Math.floor(e.difficulty / 2),
        maxHp: 1 + Math.floor(e.difficulty / 2),
        vx: -140 - e.difficulty * 20,
        vy: 0,
        score: 80,
        color: '#b8ff3c',
        fireCd: 99,
        phase: Math.random() * 10,
        pattern: 'drone',
      });
    }
  }

  e.fireCd -= dt;
  e.beamCd -= dt;
  const target = player?.alive ? player : null;

  if (e.fireCd <= 0) {
    const p = e.combatPhase;
    const d = e.difficulty;
    if (p === 1) {
      e.fireCd = 0.55 - d * 0.05;
      const spread = 3 + d;
      for (let i = -spread; i <= spread; i++) {
        pushBullet(bullets, {
          x: e.x,
          y: e.y + e.h / 2,
          vx: -240 - d * 20,
          vy: i * (45 + d * 8),
          color: e.color,
        });
      }
      if (Math.random() < 0.45) aimedShot(bullets, e, target, 300 + d * 30, '#ff8a3d', { w: 10, h: 6 });
    } else if (p === 2) {
      e.fireCd = 0.38 - d * 0.04;
      e.spiralAngle += 0.45;
      const arms = 6 + d;
      for (let i = 0; i < arms; i++) {
        const a = e.spiralAngle + (Math.PI * 2 * i) / arms;
        pushBullet(bullets, {
          x: e.x + 20,
          y: e.y + e.h / 2,
          w: 7,
          h: 7,
          vx: Math.cos(a) * (180 + d * 25),
          vy: Math.sin(a) * (180 + d * 25),
          color: '#8b5cff',
          life: 3.5,
        });
      }
      aimedShot(bullets, e, target, 340 + d * 40, '#ff2bd6', { w: 12, h: 6 });
    } else {
      e.fireCd = 0.28 - d * 0.03;
      e.spiralAngle += 0.7;
      for (let i = 0; i < 10 + d * 2; i++) {
        const a = e.spiralAngle + (Math.PI * 2 * i) / (10 + d * 2);
        pushBullet(bullets, {
          x: e.x + 16,
          y: e.y + e.h / 2,
          vx: Math.cos(a) * (220 + d * 30),
          vy: Math.sin(a) * (220 + d * 30),
          color: i % 2 ? '#ff2bd6' : '#ff3b6b',
          life: 3.2,
        });
      }
      for (let k = -1; k <= 1; k++) {
        aimedShot(bullets, e, target, 380 + d * 40, '#ff8a3d', { w: 14, h: 7 });
      }
      if (Math.random() < 0.4) {
        pushBullet(bullets, {
          x: e.x,
          y: e.y + e.h / 2 - 5,
          w: 28,
          h: 10,
          vx: -420 - d * 40,
          vy: (Math.random() - 0.5) * 30,
          color: '#fff',
          dmg: 2,
          life: 2.5,
        });
      }
    }
  }

  if (e.combatPhase >= 3 && e.beamCd <= 0) {
    e.beamCd = 4.5 - e.difficulty * 0.4;
    const y0 = e.y + e.h / 2;
    for (let i = 0; i < 12; i++) {
      pushBullet(bullets, {
        x: e.x - i * 28,
        y: y0 - 4 + Math.sin(i * 0.4) * 6,
        w: 22,
        h: 8,
        vx: -480,
        vy: 0,
        color: '#00f0ff',
        life: 1.2,
      });
    }
  }

  return result;
}

export function updateEnemy(e, dt, worldH, bullets, player = null) {
  if (e.type === 'boss') return updateBoss(e, dt, worldH, bullets, player);
  e.phase += dt;

  if (e.pattern === 'sine') {
    e.y += Math.sin(e.phase * 3) * 60 * dt;
    e.x += e.vx * dt;
  } else if (e.pattern === 'zigzag') {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.y < 10 || e.y + e.h > worldH - 10) e.vy *= -1;
  } else if (e.pattern === 'drone') {
    e.x += e.vx * dt;
    e.y += Math.sin(e.phase * 5 + e.x * 0.02) * 40 * dt;
  } else if (e.pattern === 'asteroid') {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.rot = (e.rot || 0) + (e.spin || 1) * dt;
    if (e.y < 8 || e.y + e.h > worldH - 8) e.vy *= -1;
  } else if (e.pattern === 'sniper') {
    e.x += e.vx * dt;
    if (player) {
      const ty = player.y + player.h / 2 - (e.y + e.h / 2);
      e.y += Math.max(-80, Math.min(80, ty)) * dt * 0.8;
    }
  } else if (e.pattern === 'bomber') {
    e.x += e.vx * dt;
    e.y += Math.sin(e.phase * 1.5) * 30 * dt;
  } else {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  e.fireCd -= dt;
  if (e.fireCd <= 0 && e.type !== 'drone' && e.type !== 'asteroid') {
    if (e.pattern === 'sniper') {
      e.fireCd = 1.5 + Math.random() * 0.4;
      aimedShot(bullets, e, player, 420, '#ff8a3d', { w: 14, h: 5, dmg: 1, life: 3 });
    } else if (e.pattern === 'bomber') {
      e.fireCd = 2 + Math.random();
      for (let i = -1; i <= 1; i++) {
        pushBullet(bullets, {
          x: e.x,
          y: e.y + e.h / 2,
          w: 12,
          h: 12,
          vx: -160,
          vy: i * 90,
          color: '#ff3b6b',
          dmg: 1,
          life: 3.5,
        });
      }
    } else {
      e.fireCd = e.type === 'tank' ? 1.5 : 1.1 + Math.random() * 0.8;
      pushBullet(bullets, {
        x: e.x,
        y: e.y + e.h / 2 - 3,
        w: 8,
        h: 6,
        vx: -260 - Math.random() * 40,
        vy: (Math.random() - 0.5) * 40,
        color: e.color,
        life: 3,
      });
    }
  }
  return null;
}

export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;

  if (e.type === 'boss') {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    const enrage = e.combatPhase >= 3;
    const flash = e.invulnFlash > 0 && Math.floor(e.invulnFlash * 20) % 2 === 0;
    ctx.shadowColor = enrage ? '#ff3b6b' : e.color;
    ctx.shadowBlur = 20 + pulse * 16 + e.combatPhase * 6;
    const g = ctx.createRadialGradient(
      e.x + e.w / 2,
      e.y + e.h / 2,
      8,
      e.x + e.w / 2,
      e.y + e.h / 2,
      55 + e.difficulty * 8
    );
    g.addColorStop(0, flash ? '#fff' : enrage ? '#ffd0e0' : '#fff');
    g.addColorStop(0.2, e.color);
    g.addColorStop(0.55, enrage ? '#5a0020' : '#1a0530');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h / 2);
    ctx.lineTo(e.x + 24, e.y);
    ctx.lineTo(e.x + e.w, e.y + 14);
    ctx.lineTo(e.x + e.w - 12, e.y + e.h / 2);
    ctx.lineTo(e.x + e.w, e.y + e.h - 14);
    ctx.lineTo(e.x + 24, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = e.combatPhase === 3 ? '#ff3b6b' : e.combatPhase === 2 ? '#ff8a3d' : '#00f0ff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(e.x + e.w * 0.45, e.y + e.h / 2, 18 + e.combatPhase * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const pct = e.hp / e.maxHp;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - 4, e.y - 20, e.w + 8, 8);
    ctx.fillStyle = pct > 0.66 ? '#00f0ff' : pct > 0.33 ? '#ff8a3d' : '#ff3b6b';
    ctx.fillRect(e.x - 4, e.y - 20, (e.w + 8) * pct, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Orbitron, sans-serif';
    ctx.fillText(`${e.name} · P${e.combatPhase}`, e.x, e.y - 26);
  } else if (e.type === 'asteroid') {
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.rotate(e.rot || 0);
    ctx.fillStyle = '#4a5568';
    ctx.shadowColor = '#8ab';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7;
      const r = e.w / 2 * (0.75 + ((i * 37) % 5) * 0.05);
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a9bb0';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (e.type === 'tank') {
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y + 4, e.w, e.h - 8);
    ctx.fillRect(e.x + 8, e.y, e.w - 16, e.h);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(e.x + 12, e.y + e.h / 2 - 4, 14, 8);
  } else if (e.type === 'zigzag') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h / 2);
    ctx.lineTo(e.x + e.w, e.y);
    ctx.lineTo(e.x + e.w * 0.7, e.y + e.h / 2);
    ctx.lineTo(e.x + e.w, e.y + e.h);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'sniper') {
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y + 4, e.w, e.h - 8);
    ctx.fillRect(e.x - 6, e.y + e.h / 2 - 2, 14, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x + e.w - 8, e.y + e.h / 2 - 1, 6, 2);
  } else if (e.type === 'bomber') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd0d8';
    ctx.beginPath();
    ctx.arc(e.x + e.w * 0.35, e.y + e.h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'drone') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h / 2);
    ctx.lineTo(e.x + e.w * 0.35, e.y);
    ctx.lineTo(e.x + e.w, e.y + 3);
    ctx.lineTo(e.x + e.w, e.y + e.h - 3);
    ctx.lineTo(e.x + e.w * 0.35, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#05060f';
    ctx.fillRect(e.x + e.w * 0.45, e.y + e.h / 2 - 2, 8, 4);
  }

  // small HP bar for tough units
  if (e.maxHp > 2 && e.type !== 'boss' && e.hp < e.maxHp) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(e.x, e.y - 6, e.w, 3);
    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(e.x, e.y - 6, e.w * (e.hp / e.maxHp), 3);
  }
  ctx.restore();
}

export function createPowerup(x, y, forced = null) {
  const types = ['heal', 'twin', 'spread', 'rail', 'shield', 'bomb', 'magnet', 'overdrive', 'plasma'];
  const type = forced || types[Math.floor(Math.random() * types.length)];
  const colors = {
    heal: '#b8ff3c',
    twin: '#00f0ff',
    spread: '#ff8a3d',
    rail: '#ff2bd6',
    shield: '#8b5cff',
    bomb: '#ff3b6b',
    magnet: '#4dffc3',
    overdrive: '#ffd24a',
    plasma: '#c4a0ff',
  };
  return {
    x,
    y,
    w: 20,
    h: 20,
    type,
    color: colors[type] || '#00f0ff',
    life: 12,
    phase: 0,
  };
}

export function drawPowerup(ctx, p) {
  p.phase += 0.12;
  ctx.save();
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 16;
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2 + Math.sin(p.phase) * 4);
  ctx.rotate(p.phase * 0.4);
  ctx.fillStyle = p.color;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 4);
    ctx.fill();
  } else {
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
  ctx.fillStyle = '#05060f';
  ctx.font = 'bold 9px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  const label = {
    heal: '+',
    twin: 'T',
    spread: 'S',
    rail: 'R',
    shield: '◆',
    bomb: 'B',
    magnet: 'M',
    overdrive: '★',
    plasma: 'P',
  }[p.type];
  ctx.fillText(label, 0, 1);
  ctx.restore();
}
