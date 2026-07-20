/** Ships, bullets, enemies, powerups, boss */

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { rectsOverlap };

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 36;
    this.h = 22;
    this.speed = 280;
    this.boost = false;
    this.lives = 3;
    this.shield = 1;
    this.invuln = 0;
    this.fireCd = 0;
    this.weapon = 'pulse'; // pulse | twin | spread | rail
    this.weaponTimer = 0;
    this.alive = true;
    this.enginePhase = 0;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  hit() {
    if (this.invuln > 0) return false;
    if (this.shield > 0.35) {
      this.shield = Math.max(0, this.shield - 0.45);
      this.invuln = 0.8;
      return 'shield';
    }
    this.lives -= 1;
    this.shield = 1;
    this.invuln = 1.6;
    if (this.lives <= 0) {
      this.alive = false;
    }
    return 'hull';
  }

  update(dt, input, worldH) {
    this.enginePhase += dt * 18;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) this.weapon = 'pulse';
    }
    if (this.fireCd > 0) this.fireCd -= dt;

    // shield regen when not boosting
    if (!this.boost) {
      this.shield = Math.min(1, this.shield + dt * 0.12);
    } else {
      this.shield = Math.max(0, this.shield - dt * 0.15);
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

    // touch drag target
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

    const spd = this.speed * (this.boost && this.shield > 0.05 ? 1.55 : 1);
    this.x += dx * spd * dt;
    this.y += dy * spd * dt;
    this.x = Math.max(8, Math.min(this.x, 420));
    this.y = Math.max(8, Math.min(this.y, worldH - this.h - 8));
  }

  tryFire(bullets) {
    if (this.fireCd > 0 || !this.alive) return null;
    const cx = this.x + this.w;
    const cy = this.y + this.h / 2;
    const mk = (vx, vy, dmg = 1, color = '#00f0ff', w = 10, h = 3) => {
      bullets.push({
        x: cx,
        y: cy - h / 2,
        w,
        h,
        vx,
        vy,
        dmg,
        color,
        fromPlayer: true,
        life: 2,
      });
    };

    const weapon = this.weapon;
    if (weapon === 'twin') {
      mk(520, 0, 1, '#00f0ff');
      mk(520, 0, 1, '#00f0ff');
      bullets[bullets.length - 1].y -= 8;
      bullets[bullets.length - 2].y += 6;
      this.fireCd = 0.14;
    } else if (weapon === 'spread') {
      mk(480, -120, 1, '#b8ff3c');
      mk(520, 0, 1, '#b8ff3c');
      mk(480, 120, 1, '#b8ff3c');
      this.fireCd = 0.2;
    } else if (weapon === 'rail') {
      mk(780, 0, 3, '#ff2bd6', 18, 4);
      this.fireCd = 0.32;
    } else {
      mk(560, 0, 1, '#00f0ff');
      this.fireCd = 0.16;
    }
    return weapon;
  }

  draw(ctx) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    if (blink) return;

    const x = this.x;
    const y = this.y;
    ctx.save();

    // engine glow
    const pulse = 0.5 + 0.5 * Math.sin(this.enginePhase);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16 + pulse * 10;
    ctx.fillStyle = `rgba(0, 240, 255, ${0.35 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + this.h / 2);
    ctx.lineTo(x - 14 - pulse * 8, y + this.h / 2 - 5);
    ctx.lineTo(x - 14 - pulse * 8, y + this.h / 2 + 5);
    ctx.closePath();
    ctx.fill();

    // body
    const grad = ctx.createLinearGradient(x, y, x + this.w, y);
    grad.addColorStop(0, '#0a2a3a');
    grad.addColorStop(0.4, '#00e0ff');
    grad.addColorStop(1, '#8b5cff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x + this.w, y + this.h / 2);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x, y + this.h - 4);
    ctx.lineTo(x + 8, y + this.h);
    ctx.closePath();
    ctx.fill();

    // cockpit
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff2bd6';
    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(x + 14, y + this.h / 2 - 3, 10, 6);

    // wing accents
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b8ff3c';
    ctx.fillRect(x + 6, y + 1, 8, 2);
    ctx.fillRect(x + 6, y + this.h - 3, 8, 2);

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
      vy: Math.sin(y) * 20,
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
      w: 40,
      h: 28,
      hp: Math.ceil(4 * hpMul),
      maxHp: Math.ceil(4 * hpMul),
      vx: -speed * 0.55,
      vy: 0,
      score: 250,
      color: levelCfg.palette[1] || '#ff8a3d',
      fireCd: 1.8,
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
      vx: -speed * 1.1,
      vy: 120,
      score: 150,
      color: '#ff2bd6',
      fireCd: 1.4,
      phase: Math.random() * Math.PI * 2,
      pattern: 'zigzag',
    };
  }
  // drone swarm unit
  return {
    type: 'drone',
    x,
    y,
    w: 18,
    h: 14,
    hp: Math.ceil(1 * hpMul),
    maxHp: Math.ceil(1 * hpMul),
    vx: -speed * 1.3,
    vy: 0,
    score: 80,
    color: '#b8ff3c',
    fireCd: 99,
    phase: Math.random() * 10,
    pattern: 'drone',
  };
}

/**
 * Harder multi-phase bosses.
 * difficulty: 1–3+ (from levelCfg.bossDifficulty)
 * Returns { boss, extras } where extras may include initial minions later.
 */
export function createBoss(levelCfg, w, h, playerRef = null) {
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
    combatPhase: 1, // 1 healthy, 2 mid, 3 enrage
    pattern: 'boss',
    entered: false,
    difficulty: diff,
    dashCd: 3.5,
    dashTimer: 0,
    minionCd: 4,
    spiralAngle: 0,
    beamCd: 5,
    beamTimer: 0,
    playerRef,
    lastPhase: 1,
    invulnFlash: 0,
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
  if (!target) {
    pushBullet(bullets, {
      x: from.x,
      y: from.y + from.h / 2,
      vx: -speed,
      vy: 0,
      color,
      ...extra,
    });
    return;
  }
  const cx = from.x;
  const cy = from.y + from.h / 2;
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

/**
 * @returns {{ phaseChanged?: number, spawned?: object[] }}
 */
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

  // Phase thresholds
  const pct = e.hp / e.maxHp;
  const nextPhase = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (nextPhase !== e.combatPhase) {
    e.combatPhase = nextPhase;
    e.lastPhase = nextPhase;
    e.invulnFlash = 0.4;
    result.phaseChanged = nextPhase;
    // brief speed spike on phase change
    e.vy = (e.vy > 0 ? 1 : -1) * (90 + e.difficulty * 25 + nextPhase * 20);
  }

  // Movement — faster / weaving in later phases
  const speedMul = 1 + (e.combatPhase - 1) * 0.35 + e.difficulty * 0.08;
  if (e.dashTimer > 0) {
    e.dashTimer -= dt;
    e.x += e.dashVx * dt;
    e.y += e.dashVy * dt;
    if (e.dashTimer <= 0) {
      e.x = Math.min(e.x, 800);
      e.dashVx = 0;
    }
  } else {
    e.y += e.vy * dt * speedMul;
    // slight horizontal weave in phase 2+
    if (e.combatPhase >= 2) {
      e.x = 760 + Math.sin(e.phase * 1.8) * (18 + e.difficulty * 6);
    }
    if (e.y < 16 || e.y + e.h > worldH - 16) {
      e.vy *= -1;
      e.y = Math.max(16, Math.min(e.y, worldH - e.h - 16));
    }
  }

  // Dash attack (phase 2+)
  e.dashCd -= dt;
  if (e.combatPhase >= 2 && e.dashCd <= 0 && e.dashTimer <= 0 && player) {
    e.dashCd = 4.2 - e.difficulty * 0.4 - (e.combatPhase === 3 ? 0.8 : 0);
    e.dashTimer = 0.55;
    const ty = player.y + player.h / 2 - (e.y + e.h / 2);
    e.dashVx = -320 - e.difficulty * 40;
    e.dashVy = Math.max(-200, Math.min(200, ty * 2.2));
  }

  // Spawn minion drones (phase 2+)
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

  // Firing patterns by phase
  e.fireCd -= dt;
  e.beamCd -= dt;
  const target = player && player.alive ? player : null;

  if (e.fireCd <= 0) {
    const p = e.combatPhase;
    const d = e.difficulty;

    if (p === 1) {
      // Fan + occasional aimed
      e.fireCd = 0.55 - d * 0.05;
      const spread = 3 + d;
      for (let i = -spread; i <= spread; i++) {
        pushBullet(bullets, {
          x: e.x,
          y: e.y + e.h / 2,
          w: 8,
          h: 8,
          vx: -240 - d * 20,
          vy: i * (45 + d * 8),
          color: e.color,
          dmg: 1,
        });
      }
      if (Math.random() < 0.4) aimedShot(bullets, e, target, 300 + d * 30, '#ff8a3d', { w: 10, h: 6 });
    } else if (p === 2) {
      // Spiral ring + twin aimed
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
          dmg: 1,
          life: 3.5,
        });
      }
      aimedShot(bullets, e, target, 340 + d * 40, '#ff2bd6', { w: 12, h: 6, dmg: 1 });
      aimedShot(
        bullets,
        { x: e.x, y: e.y + 10, w: e.w, h: e.h - 20 },
        target,
        300,
        '#00f0ff',
        { w: 8, h: 8 }
      );
    } else {
      // ENRAGE: dense ring, aimed volleys, heavy bolts
      e.fireCd = 0.28 - d * 0.03;
      e.spiralAngle += 0.7;
      for (let i = 0; i < 10 + d * 2; i++) {
        const a = e.spiralAngle + (Math.PI * 2 * i) / (10 + d * 2);
        pushBullet(bullets, {
          x: e.x + 16,
          y: e.y + e.h / 2,
          w: 8,
          h: 8,
          vx: Math.cos(a) * (220 + d * 30),
          vy: Math.sin(a) * (220 + d * 30),
          color: i % 2 ? '#ff2bd6' : '#ff3b6b',
          dmg: 1,
          life: 3.2,
        });
      }
      for (let k = -1; k <= 1; k++) {
        aimedShot(bullets, e, target, 380 + d * 40, '#ff8a3d', {
          w: 14,
          h: 7,
          dmg: 1,
          vy: k * 40,
        });
      }
      // heavy rail bolts
      if (Math.random() < 0.35) {
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

  // Sweeping beam (phase 3)
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
        dmg: 1,
        life: 1.2,
      });
    }
  }

  return result;
}

export function updateEnemy(e, dt, worldH, bullets, player = null) {
  if (e.type === 'boss') {
    return updateBoss(e, dt, worldH, bullets, player);
  }
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
  } else {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  e.fireCd -= dt;
  if (e.fireCd <= 0 && e.type !== 'drone') {
    e.fireCd = e.type === 'tank' ? 1.6 : 1.1 + Math.random() * 0.8;
    bullets.push({
      x: e.x,
      y: e.y + e.h / 2 - 3,
      w: 8,
      h: 6,
      vx: -260 - Math.random() * 40,
      vy: (Math.random() - 0.5) * 40,
      dmg: 1,
      color: e.color,
      fromPlayer: false,
      life: 3,
    });
  }
}

export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  if (e.type === 'boss') {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    const enrage = e.combatPhase >= 3;
    const flash = e.invulnFlash > 0 && Math.floor(e.invulnFlash * 20) % 2 === 0;
    // aura
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
    // phase rings
    ctx.strokeStyle = e.combatPhase === 3 ? '#ff3b6b' : e.combatPhase === 2 ? '#ff8a3d' : '#00f0ff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(e.x + e.w * 0.45, e.y + e.h / 2, 18 + e.combatPhase * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // hp bar
    const pct = e.hp / e.maxHp;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - 4, e.y - 20, e.w + 8, 8);
    ctx.fillStyle = pct > 0.66 ? '#00f0ff' : pct > 0.33 ? '#ff8a3d' : '#ff3b6b';
    ctx.fillRect(e.x - 4, e.y - 20, (e.w + 8) * pct, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Orbitron, sans-serif';
    ctx.fillText(`${e.name} · P${e.combatPhase}`, e.x, e.y - 26);
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
  } else if (e.type === 'drone') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // scout — classic Space Impact-ish blocky ship facing left
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
  ctx.restore();
}

export function createPowerup(x, y) {
  const types = ['heal', 'twin', 'spread', 'rail', 'shield'];
  const type = types[Math.floor(Math.random() * types.length)];
  const colors = {
    heal: '#b8ff3c',
    twin: '#00f0ff',
    spread: '#ff8a3d',
    rail: '#ff2bd6',
    shield: '#8b5cff',
  };
  return {
    x,
    y,
    w: 18,
    h: 18,
    type,
    color: colors[type],
    life: 10,
    phase: 0,
  };
}

export function drawPowerup(ctx, p) {
  p.phase += 0.1;
  ctx.save();
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 14;
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2 + Math.sin(p.phase) * 3);
  ctx.rotate(p.phase * 0.5);
  ctx.fillStyle = p.color;
  ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  ctx.fillStyle = '#05060f';
  ctx.font = 'bold 10px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  const label = { heal: '+', twin: 'T', spread: 'S', rail: 'R', shield: '◆' }[p.type];
  ctx.fillText(label, 0, 1);
  ctx.restore();
}
