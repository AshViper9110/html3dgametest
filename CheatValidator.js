class CheatValidator {
  constructor() {
    this.processedInputs = new Set();
    this.packetCounts = new Map();
    this.playerPositions = new Map();
    this.lastFireTimes = new Map();
    this.lastTimestamps = new Map();
    this.maxPacketRate = 100;
    this.maxPacketsPerFrame = 200;
  }

  validatePacket(data, peerId) {
    if (!this._checkSpam(peerId)) return false;
    if (!this._sanitize(data)) return false;
    return true;
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
    const now = performance.now();
    if (typeof timestamp !== 'number' || !isFinite(timestamp)) return false;
    if (timestamp > now + 500) return false;
    if (now - timestamp > 3000) return false;
    const last = this.lastTimestamps.get(peerId) || 0;
    if (timestamp < last) return false;
    this.lastTimestamps.set(peerId, timestamp);
    return true;
  }

  isReplayAttack(inputId) {
    if (!inputId) return true;
    if (this.processedInputs.has(inputId)) return true;
    this.processedInputs.add(inputId);
    if (this.processedInputs.size > 20000) {
      const arr = Array.from(this.processedInputs);
      this.processedInputs = new Set(arr.slice(-10000));
    }
    return false;
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
    if (!lastPos) return true;
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxDist = maxSpeed * dt * 1.3;
    return dist <= maxDist;
  }

  validateNoWarp(currentPos, lastPos, maxDist) {
    if (!lastPos) return true;
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist <= maxDist;
  }

  validateFireRate(peerId, weapon, timestamp) {
    const key = peerId + '_' + weapon;
    const lastFire = this.lastFireTimes.get(key) || 0;
    const wp = WEAPONS[weapon];
    if (!wp) return false;
    const minInterval = wp.fireRate * 1000;
    if (timestamp - lastFire < minInterval * 0.85) return false;
    this.lastFireTimes.set(key, timestamp);
    return true;
  }

  validateWeapon(weapon) {
    return !!WEAPONS[weapon];
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
  }
}
