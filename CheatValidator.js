class CheatValidator {
  constructor() {
    this.processedInputs = new Set();
    this.packetCounts = new Map();
    this.playerPositions = new Map();
    this.lastFireTimes = new Map();
    this.lastTimestamps = new Map();
    this.lastHealths = new Map();
    this.lastAmmo = new Map();
    this.maxPacketRate = 100;
    this.maxPacketsPerFrame = 200;
  }

  validatePacket(data, peerId) {
    if (!this._checkSpam(peerId)) return { ok: false, reason: 'Packet Spam' };
    if (!this._sanitize(data)) return { ok: false, reason: 'Packet Tampering' };
    return { ok: true };
  }

  _sanitize(obj) {
    if (obj === null || obj === undefined) return false;
    if (typeof obj !== 'object') return false;
    for (const key in obj) {
      const val = obj[key];
      if (val === null || val === undefined) return false;
      if (typeof val === 'number' && (!isFinite(val) || isNaN(val))) return false;
      if (typeof val === 'object' && !this._sanitize(val)) return false;
    }
    return true;
  }

  validateTimestamp(timestamp, peerId) {
    const now = Date.now();
    if (typeof timestamp !== 'number' || !isFinite(timestamp)) {
      console.log('[Cheat] validateTimestamp FAIL: invalid type=%s', typeof timestamp);
      return { ok: false, reason: 'Invalid Timestamp' };
    }
    const diff = now - timestamp;
    if (timestamp > now + 500) {
      console.log('[Cheat] validateTimestamp FAIL: future by %dms (peer=%s)', timestamp - now, peerId);
      return { ok: false, reason: 'Future Timestamp' };
    }
    if (diff > 10000) {
      console.log('[Cheat] validateTimestamp FAIL: past by %dms (peer=%s) > 10000ms', diff, peerId);
      return { ok: false, reason: 'Stale Timestamp' };
    }
    const last = this.lastTimestamps.get(peerId) || 0;
    if (timestamp < last) {
      console.log('[Cheat] validateTimestamp FAIL: non-monotonic (peer=%s) ts=%d last=%d', peerId, timestamp, last);
      return { ok: false, reason: 'Replay Attack' };
    }
    this.lastTimestamps.set(peerId, timestamp);
    return { ok: true };
  }

  isReplayAttack(inputId) {
    if (!inputId) return { ok: false, reason: 'Missing Input ID' };
    if (this.processedInputs.has(inputId)) return { ok: false, reason: 'Replay Attack' };
    this.processedInputs.add(inputId);
    if (this.processedInputs.size > 20000) {
      const arr = Array.from(this.processedInputs);
      this.processedInputs = new Set(arr.slice(-10000));
    }
    return { ok: true };
  }

  _checkSpam(peerId) {
    const now = performance.now();
    let entry = this.packetCounts.get(peerId);
    if (!entry) {
      entry = { count: 0, resetTime: now + 1000 };
      this.packetCounts.set(peerId, entry);
    }
    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + 1000;
    } else {
      entry.count++;
    }
    return entry.count <= this.maxPacketRate;
  }

  isSpamming(peerId) {
    const entry = this.packetCounts.get(peerId);
    if (!entry) return false;
    return entry.count > this.maxPacketRate;
  }

  validatePosition(currentPos, lastPos, dt, maxSpeed) {
    if (!lastPos) return { ok: true };
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxDist = maxSpeed * dt * 1.3;
    if (dist > maxDist) return { ok: false, reason: 'Speed Hack' };
    return { ok: true };
  }

  validateNoWarp(currentPos, lastPos, maxDist) {
    if (!lastPos) return { ok: true };
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > maxDist) return { ok: false, reason: 'Invalid Position' };
    return { ok: true };
  }

  validateFireRate(peerId, weapon, timestamp) {
    const key = peerId + '_' + weapon;
    const lastFire = this.lastFireTimes.get(key) || 0;
    const wp = WEAPONS[weapon];
    if (!wp) return { ok: false, reason: 'Invalid Weapon' };
    const minInterval = wp.fireRate * 1000;
    if (timestamp - lastFire < minInterval * 0.85) {
      return { ok: false, reason: 'FireRate Hack' };
    }
    this.lastFireTimes.set(key, timestamp);
    return { ok: true };
  }

  validateWeapon(weapon) {
    if (!WEAPONS[weapon]) return { ok: false, reason: 'Invalid Weapon' };
    return { ok: true };
  }

  validateHealth(peerId, health) {
    if (typeof health !== 'number' || health < 0 || health > CONFIG.maxHealth * 2) {
      return { ok: false, reason: 'Invalid HP' };
    }
    return { ok: true };
  }

  validateAmmo(peerId, weapon, ammo) {
    const key = peerId + '_' + weapon;
    const last = this.lastAmmo.get(key);
    if (last !== undefined && ammo > last) {
      return { ok: false, reason: 'Invalid Ammo' };
    }
    this.lastAmmo.set(key, ammo);
    return { ok: true };
  }

  isSpamPacket(peerId) {
    if (this.isSpamming(peerId)) return { ok: false, reason: 'Packet Spam' };
    return { ok: true };
  }

  recordPosition(peerId, pos, time) {
    this.playerPositions.set(peerId, { x: pos.x, z: pos.z, time });
  }

  getLastPosition(peerId) {
    return this.playerPositions.get(peerId);
  }

  reset() {
    this.processedInputs.clear();
    this.packetCounts.clear();
    this.playerPositions.clear();
    this.lastFireTimes.clear();
    this.lastTimestamps.clear();
    this.lastHealths.clear();
    this.lastAmmo.clear();
  }
}
