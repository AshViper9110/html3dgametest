class CheatValidator {
  constructor() {
    this.processedInputs = new Set();
    this.lastFireTimes = new Map();
    this.lastPacketSeq = new Map();
    this.shadowHealth = new Map();
    this.positionHistory = new Map();
    this.packetCount = new Map();
    this.MAX_PACKETS_PER_SEC = 120;
    this.MAX_SPEED = CONFIG.playerSpeed * 2.5;
    this.MAX_DASH_SPEED = CONFIG.dashSpeed * 1.5;
    this.MAX_DIST_PER_TICK = this.MAX_SPEED * 0.1;
    this.VALID_WEAPON_IDS = null;
  }

  _ensureWeaponList() {
    if (!this.VALID_WEAPON_IDS) {
      this.VALID_WEAPON_IDS = new Set(WEAPON_REGISTRY.getAll());
    }
    return this.VALID_WEAPON_IDS;
  }

  static sanitize(v, fallback) {
    if (v === undefined || v === null || (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v)))) {
      return fallback !== undefined ? fallback : 0;
    }
    return v;
  }

  static sanitizeVec3(obj, fallback) {
    if (!obj || typeof obj !== 'object') return fallback || { x: 0, y: 0, z: 0 };
    return {
      x: CheatValidator.sanitize(obj.x, 0),
      y: CheatValidator.sanitize(obj.y, 0),
      z: CheatValidator.sanitize(obj.z, 0),
    };
  }

  static isString(v) { return typeof v === 'string'; }
  static isNumber(v) { return typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v); }
  static isPositiveNumber(v) { return CheatValidator.isNumber(v) && v >= 0; }
  static isInRange(v, min, max) { return CheatValidator.isNumber(v) && v >= min && v <= max; }

  validatePacket(data, peerId) {
    if (!data || typeof data !== 'object') return { ok: false, reason: 'InvalidPacket' };
    if (!CheatValidator.isString(data.type)) return { ok: false, reason: 'InvalidType' };
    if (!this._validateSequencing(peerId, data.seq)) return { ok: false, reason: 'SeqError' };
    if (this._isRateLimited(peerId)) return { ok: false, reason: 'RateLimit' };
    if (data.timestamp && !this.validateTimestamp(data.timestamp, peerId).ok) return { ok: false, reason: 'BadTimestamp' };
    return { ok: true };
  }

  _validateSequencing(peerId, seq) {
    if (seq === undefined || seq === null) return true;
    if (!CheatValidator.isPositiveNumber(seq)) return false;
    const lastSeq = this.lastPacketSeq.get(peerId) || -1;
    if (seq <= lastSeq) return false;
    this.lastPacketSeq.set(peerId, seq);
    return true;
  }

  _isRateLimited(peerId) {
    const now = Date.now();
    const bucket = this.packetCount.get(peerId) || { count: 0, resetAt: now + 1000 };
    if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + 1000; }
    bucket.count++;
    if (bucket.count > this.MAX_PACKETS_PER_SEC) return true;
    this.packetCount.set(peerId, bucket);
    return false;
  }

  validateTimestamp(timestamp, peerId) {
    if (!CheatValidator.isPositiveNumber(timestamp)) return { ok: false, reason: 'BadTimestamp' };
    const now = Date.now();
    if (timestamp > now + 5000) return { ok: false, reason: 'FutureTimestamp' };
    if (timestamp < now - 10000) return { ok: false, reason: 'TooOld' };
    return { ok: true };
  }

  isReplayAttack(inputId) {
    if (inputId === undefined || inputId === null) return { ok: false, reason: 'NoInputId' };
    const key = String(inputId);
    if (this.processedInputs.has(key)) return { ok: false, reason: 'Replay' };
    this.processedInputs.add(key);
    if (this.processedInputs.size > 10000) {
      const iter = this.processedInputs.values();
      for (let i = 0; i < 5000; i++) { this.processedInputs.delete(iter.next().value); }
    }
    return { ok: true };
  }

  validatePosition(currentPos, lastPos, dt, speedMult) {
    if (!currentPos || !lastPos) return { ok: true };
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxDist = (this.MAX_SPEED * (speedMult || 1)) * Math.min(dt || 0.05, 0.1);
    if (dist > maxDist + 2) return { ok: false, reason: 'SpeedHack', dist };
    return { ok: true, dist };
  }

  validateNoWarp(currentPos, lastPos, maxDist) {
    if (!currentPos || !lastPos) return { ok: true };
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > (maxDist || 25)) return { ok: false, reason: 'Warp' };
    return { ok: true };
  }

  validateFireRate(peerId, weapon, timestamp) {
    const key = peerId + '_' + weapon;
    const lastFire = this.lastFireTimes.get(key) || 0;
    const wp = WEAPONS[weapon];
    if (!wp) return { ok: false, reason: 'InvalidWeapon' };
    const minInterval = wp.fireRate * 1000;
    const effectiveInterval = this._getPassiveFireRate(peerId, wp);
    if ((timestamp || Date.now()) - lastFire < effectiveInterval * 0.85) {
      return { ok: false, reason: 'FireRateHack' };
    }
    this.lastFireTimes.set(key, timestamp || Date.now());
    return { ok: true };
  }

  _getPassiveFireRate(peerId, wp) {
    if (!this._passiveManager) return wp.fireRate * 1000;
    const mult = this._passiveManager.getFireRateMultiplier(peerId);
    return (wp.fireRate * 1000) / (mult || 1);
  }

  setPassiveManager(pm) { this._passiveManager = pm; }

  validateWeapon(weapon) {
    if (!weapon || !CheatValidator.isString(weapon)) return { ok: false, reason: 'InvalidWeaponType' };
    const valid = this._ensureWeaponList();
    if (!valid.has(weapon)) return { ok: false, reason: 'UnknownWeapon' };
    return { ok: true };
  }

  validateWeaponDamage(weapon, reportedDamage) {
    const wp = WEAPONS[weapon];
    if (!wp) return { ok: false, reason: 'UnknownWeapon' };
    const maxDmg = wp.damage * (wp.headshotMultiplier || 2) * 3;
    if (!CheatValidator.isPositiveNumber(reportedDamage) || reportedDamage > maxDmg) {
      return { ok: false, reason: 'DamageHack' };
    }
    return { ok: true };
  }

  validateHealth(peerId, health) {
    if (!CheatValidator.isInRange(health, 0, CONFIG.maxHealth * 3)) return { ok: false, reason: 'InvalidHealth' };
    const shadow = this.shadowHealth.get(peerId);
    if (shadow !== undefined && health > shadow + 5) return { ok: false, reason: 'HealthRegenHack' };
    return { ok: true };
  }

  validateAmmo(peerId, weapon, ammo) {
    const wp = WEAPONS[weapon];
    if (!wp) return { ok: false, reason: 'InvalidWeapon' };
    if (!CheatValidator.isInRange(ammo, 0, wp.magazineSize * 3)) return { ok: false, reason: 'AmmoHack' };
    return { ok: true };
  }

  validateReload(peerId, weapon, timestamp) {
    const wp = WEAPONS[weapon];
    if (!wp) return { ok: false, reason: 'InvalidWeapon' };
    if (!CheatValidator.isPositiveNumber(timestamp)) return { ok: false, reason: 'BadTimestamp' };
    return { ok: true };
  }

  isSpamPacket(peerId) {
    return { ok: true };
  }

  initShadowHealth(peerId, health) {
    this.shadowHealth.set(peerId, health);
  }

  trackDamage(peerId, damage) {
    if (!CheatValidator.isPositiveNumber(damage)) return;
    const current = this.shadowHealth.get(peerId);
    if (current !== undefined) {
      this.shadowHealth.set(peerId, Math.max(0, current - damage));
    }
  }

  trackRegen(peerId, health) {
    if (!CheatValidator.isPositiveNumber(health)) return;
    this.shadowHealth.set(peerId, health);
  }

  validateShadowHealth(peerId, reportedHealth) {
    const shadow = this.shadowHealth.get(peerId);
    if (shadow === undefined) return { ok: true };
    if (!CheatValidator.isPositiveNumber(reportedHealth)) return { ok: false, reason: 'InvalidHealth' };
    if (reportedHealth > shadow + CONFIG.maxHealth * 0.1 + 1) {
      return { ok: false, reason: 'HealthDesync: ' + reportedHealth + ' vs ' + shadow };
    }
    return { ok: true };
  }

  validatePositionComponent(v) {
    return CheatValidator.isInRange(v, -100, 100);
  }

  validateRotation(v) {
    return CheatValidator.isNumber(v);
  }

  validateVelocity(v) {
    return CheatValidator.isInRange(v, -100, 100);
  }

  validateDamage(reported) {
    if (!CheatValidator.isPositiveNumber(reported)) return { ok: false, reason: 'InvalidDamage' };
    if (reported > 500) return { ok: false, reason: 'DamageTooHigh' };
    return { ok: true };
  }

  validateRadius(v) {
    return CheatValidator.isInRange(v, 0.01, 20);
  }

  validateScale(v) {
    return CheatValidator.isInRange(v, 0.01, 10);
  }

  validatePassive(passiveId) {
    if (!passiveId || passiveId === 'none') return { ok: true };
    if (!CheatValidator.isString(passiveId)) return { ok: false, reason: 'InvalidPassiveType' };
    if (!PASSIVES[passiveId]) return { ok: false, reason: 'UnknownPassive' };
    return { ok: true };
  }

  validatePlayerId(id) {
    return CheatValidator.isString(id) && id.length > 0 && id.length < 64;
  }

  validateInput(input) {
    if (!input || typeof input !== 'object') return { ok: false, reason: 'InvalidInput' };
    if (input.forward !== undefined && typeof input.forward !== 'number') return { ok: false, reason: 'BadForward' };
    if (input.strafe !== undefined && typeof input.strafe !== 'number') return { ok: false, reason: 'BadStrafe' };
    if (input.mouseX !== undefined && !CheatValidator.isNumber(input.mouseX)) return { ok: false, reason: 'BadMouseX' };
    if (input.mouseY !== undefined && !CheatValidator.isNumber(input.mouseY)) return { ok: false, reason: 'BadMouseY' };
    return { ok: true };
  }

  recordPosition(peerId, pos, time) {
    if (!this.positionHistory.has(peerId)) {
      this.positionHistory.set(peerId, []);
    }
    const hist = this.positionHistory.get(peerId);
    hist.push({ pos: { x: pos.x, y: pos.y, z: pos.z }, time: time || Date.now() });
    while (hist.length > 0 && hist[hist.length - 1].time - hist[0].time > 500) {
      hist.shift();
    }
  }

  getLastPosition(peerId) {
    const hist = this.positionHistory.get(peerId);
    if (!hist || hist.length === 0) return null;
    return hist[hist.length - 1].pos;
  }

  getPositionAtTime(peerId, time) {
    const hist = this.positionHistory.get(peerId);
    if (!hist || hist.length === 0) return null;
    if (hist.length === 1) return hist[0].pos;
    let before = hist[0];
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].time >= time) {
        const t = (time - before.time) / Math.max(hist[i].time - before.time, 1);
        return {
          x: before.pos.x + (hist[i].pos.x - before.pos.x) * t,
          y: before.pos.y + (hist[i].pos.y - before.pos.y) * t,
          z: before.pos.z + (hist[i].pos.z - before.pos.z) * t,
        };
      }
      before = hist[i];
    }
    return hist[hist.length - 1].pos;
  }

  reset() {
    this.processedInputs.clear();
    this.lastFireTimes.clear();
    this.lastPacketSeq.clear();
    this.shadowHealth.clear();
    this.positionHistory.clear();
    this.packetCount.clear();
  }
}
