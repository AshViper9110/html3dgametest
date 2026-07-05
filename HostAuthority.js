class HostAuthority {
  constructor(game) {
    this.game = game;
    this.hostProjectiles = [];
    this.projIdCounter = 0;
    this.ammoStates = new Map();
    this.heatStates = new Map();
    this.playerStats = new Map();
    this.respawnedPeers = new Set();
    this._gravityZones = [];
    this._drones = new Map();
    this._projIdCounter = 0;
    this._projIdSet = new Set();
    this._hitThisTick = new Set();
    this._processedInputs = new Set();
    this._positionHistory = new Map();
    this._pendingInputs = new Map();
    this.HISTORY_DURATION = 400;
  }

  _validatePeerId(peerId) {
    return peerId && typeof peerId === 'string' && this.game.players.has(peerId);
  }

  _getWp(weapon) {
    return WEAPONS[weapon] || null;
  }

  _sanitizeDamage(dmg, weapon) {
    const wp = this._getWp(weapon);
    if (!wp) return 0;
    const maxDmg = wp.damage * (wp.headshotMultiplier || 2) * 3;
    if (typeof dmg !== 'number' || Number.isNaN(dmg) || dmg <= 0 || dmg > maxDmg) return wp.damage;
    return dmg;
  }

  _sanitizePos(obj) {
    if (!obj || typeof obj !== 'object') return { x: 0, y: 0, z: 0 };
    return {
      x: Math.max(-100, Math.min(100, Number(obj.x) || 0)),
      y: Math.max(-100, Math.min(100, Number(obj.y) || 0)),
      z: Math.max(-100, Math.min(100, Number(obj.z) || 0)),
    };
  }

  _sanitizeDir(obj) {
    if (!obj || typeof obj !== 'object') return { x: 0, y: 0, z: 1 };
    let x = Number(obj.x) || 0, z = Number(obj.z) || 0;
    if (Math.abs(x) > 1 || Math.abs(z) > 1) { x = 0; z = 1; }
    const len = Math.sqrt(x * x + z * z);
    if (len < 0.001) { x = 0; z = 1; }
    else { x /= len; z /= len; }
    return { x, y: 0, z };
  }

  _validateWeapon(weapon) {
    if (!weapon || typeof weapon !== 'string') return false;
    return !!WEAPONS[weapon];
  }

  _isDuplicateInput(inputId) {
    if (inputId === undefined || inputId === null) return true;
    const key = String(inputId);
    if (this._processedInputs.has(key)) return true;
    this._processedInputs.add(key);
    if (this._processedInputs.size > 50000) {
      const iter = this._processedInputs.values();
      for (let i = 0; i < 25000; i++) this._processedInputs.delete(iter.next().value);
    }
    return false;
  }

  /* ============ POSITION HISTORY (Lag Compensation) ============ */
  recordPosition(peerId, pos, rot, time) {
    if (!this._positionHistory.has(peerId)) {
      this._positionHistory.set(peerId, []);
    }
    const hist = this._positionHistory.get(peerId);
    hist.push({
      pos: { x: pos.x, y: pos.y, z: pos.z },
      rot: rot || 0,
      time: time || Date.now(),
    });
    while (hist.length > 0 && Date.now() - hist[0].time > this.HISTORY_DURATION) {
      hist.shift();
    }
  }

  _getPositionAt(peerId, time) {
    const hist = this._positionHistory.get(peerId);
    if (!hist || hist.length === 0) return null;
    if (hist.length === 1) return hist[0];
    let before = hist[0];
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].time >= time) {
        const dt = hist[i].time - before.time;
        if (dt < 1) return before;
        const t = (time - before.time) / dt;
        return {
          pos: {
            x: before.pos.x + (hist[i].pos.x - before.pos.x) * t,
            y: before.pos.y + (hist[i].pos.y - before.pos.y) * t,
            z: before.pos.z + (hist[i].pos.z - before.pos.z) * t,
          },
          rot: before.rot + (hist[i].rot - before.rot) * t,
          time,
        };
      }
      before = hist[i];
    }
    return hist[hist.length - 1];
  }

  /* ============ FIRE REQUEST ============ */
  handleFireRequest(data, peerId, inputId) {
    if (this._isDuplicateInput(inputId)) return;
    if (!this._validatePeerId(peerId)) return;
    if (!this._validateWeapon(data.weapon)) return;

    const cv = this.game.cheatValidator;
    const cm = this.game.cheatManager;

    const r = cv.validateFireRate(peerId, data.weapon, data.timestamp || Date.now());
    if (!r.ok) { if (cm) cm.report(peerId, r.reason); return; }

    if (this.respawnedPeers.has(peerId)) {
      this.refillAllAmmo(peerId);
      this.respawnedPeers.delete(peerId);
    }

    if (!this._hasAmmo(peerId, data.weapon)) return;
    this._consumeAmmo(peerId, data.weapon);

    const wp = this._getWp(data.weapon);
    if (!wp) return;
    const pellets = wp.pellets || 1;
    const spawnPos = this._sanitizePos(data.position);
    const mapHalf = this.game.arenaMap ? this.game.arenaMap.size / 2 : 40;
    const shooter = this.game.players.get(peerId);
    const shooterPos = shooter ? { x: shooter.position.x, z: shooter.position.z } : spawnPos;

    const spreadMult = this.game.passiveManager ? this.game.passiveManager.getSpreadMultiplier(peerId) : 1;

    for (let i = 0; i < pellets; i++) {
      const dir = this._sanitizeDir(data.direction);
      if (i > 0 && wp.spread > 0) {
        dir.x += (Math.random() - 0.5) * wp.spread * spreadMult;
        dir.z += (Math.random() - 0.5) * wp.spread * spreadMult;
        const dl = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
        if (dl > 0.001) { dir.x /= dl; dir.z /= dl; }
      }

      const pid = peerId + '_h' + (this._projIdCounter++);
      if (this._projIdSet.has(pid)) continue;
      this._projIdSet.add(pid);
      if (this._projIdSet.size > 10000) this._projIdSet.clear();

      _v3a.set(spawnPos.x, 0, spawnPos.z);
      _v3b.set(dir.x, 0, dir.z);

      const proj = new Projectile(this.game.scene, _v3a, _v3b, peerId, pid, data.color || 0xffffff, data.weapon, mapHalf);
      if (this.game.passiveManager) {
        this.game.passiveManager.applyToProjectile(proj, peerId);
      }
      proj.isHostProjectile = true;
      this.hostProjectiles.push(proj);

      this.game.network.broadcast({
        type: 'proj_spawn',
        ownerId: peerId, pid, weapon: data.weapon,
        pos: { x: spawnPos.x, y: 0, z: spawnPos.z },
        dir: { x: dir.x, y: 0, z: dir.z },
        color: data.color || 0xffffff,
        inputId,
      });
    }

    this._sendAmmoUpdate(peerId, data.weapon);
  }

  /* ============ BEAM FIRE ============ */
  handleBeamFireRequest(data, peerId, inputId) {
    if (this._isDuplicateInput(inputId)) return;
    if (!this._validatePeerId(peerId)) return;
    if (!this._validateWeapon(data.weapon)) return;

    const cv = this.game.cheatValidator;
    const cm = this.game.cheatManager;
    const r = cv.validateFireRate(peerId, data.weapon, data.timestamp || 0);
    if (!r.ok) { if (cm) cm.report(peerId, r.reason); return; }

    if (this.respawnedPeers.has(peerId)) {
      this.refillAllAmmo(peerId);
      this.respawnedPeers.delete(peerId);
    }

    if (!this._hasAmmo(peerId, data.weapon)) return;
    this._consumeAmmo(peerId, data.weapon);

    const wp = this._getWp(data.weapon);
    if (!wp) return;
    const origin = this._sanitizePos(data.origin);
    const dir = this._sanitizeDir(data.direction);
    const passive = this.game.passiveManager;
    const map = this.game.arenaMap;

    const beamData = {
      range: wp.range || 40,
      width: wp.hitRadius || 0.8,
      damage: wp.damage,
      spread: 0,
      cooldown: 0,
      reflectCount: 0,
      plasmaBoomRadius: 0,
      criticalChance: 0,
      criticalDamageMultiplier: 2,
    };
    if (passive) passive.applyToBeam(beamData, peerId);

    const maxRange = beamData.range;
    const beamHitRadius = beamData.width;
    const result = this._beamRaycast(origin, dir, maxRange, map, peerId, wp, beamHitRadius, data.timestamp || Date.now());

    const beamMsg = {
      type: 'beam_effect',
      weapon: data.weapon,
      startPos: { x: origin.x, y: 0, z: origin.z },
      endPos: { x: result.endPos.x, y: 0, z: result.endPos.z },
      color: data.color || wp.color || 0xffffff,
      pid: inputId,
    };

    if (result.hitPlayer) {
      const victim = this.game.players.get(result.hitPlayer);
      if (victim && victim.alive) {
        const killerId = peerId;
        let beamDmg = beamData.damage;
        if (beamData.criticalChance && Math.random() < beamData.criticalChance) {
          beamDmg *= beamData.criticalDamageMultiplier || 2;
        }
        if (passive) beamDmg *= passive.getDamageReduction(result.hitPlayer, 'beam');
        const killed = victim.takeDamage(beamDmg);

        const hitMsg = {
          type: 'hit', shooterId: killerId, targetId: result.hitPlayer,
          damage: beamDmg, shooterName: (this.game.players.get(killerId) || {}).name || '?',
          targetName: victim.name, lethal: killed, weapon: data.weapon,
          pos: { x: result.endPos.x, y: 0, z: result.endPos.z }, beam: true,
        };
        this.game.network.broadcast(hitMsg);
        if (killed) this._trackKill(killerId, result.hitPlayer, data.weapon);
        if (result.hitPlayer === this.game.network.myId) this.game._applyLocalHitEffects(hitMsg);
        beamMsg.hitPlayer = result.hitPlayer;
      }
    }

    beamMsg.distance = result.distance;
    this.game.network.broadcast(beamMsg);
    if (this.game.beamManager) this.game._handleBeamEffect(beamMsg);
    this._sendAmmoUpdate(peerId, data.weapon);
  }

  _beamRaycast(origin, dir, maxRange, map, ownerId, wp, customHitRadius, requestTime) {
    const endPos = { x: origin.x + dir.x * maxRange, z: origin.z + dir.z * maxRange };
    const hitRadius = customHitRadius || (wp && wp.hitRadius) || 0.8;
    let closestDist = maxRange;
    let hitPlayer = null;

    const half = map ? map.size / 2 : 20;
    const boundaryHits = this._rayAABB2D(origin, dir, -half, -half, half, half);
    if (boundaryHits !== null && boundaryHits > 0 && boundaryHits < closestDist) closestDist = boundaryHits;

    if (map && map.walls) {
      for (const wall of map.walls) {
        const wx = wall.p[0], wz = wall.p[2];
        const hx = wall.s[0] / 2, hz = wall.s[2] / 2;
        const dist = this._rayAABB2D(origin, dir, wx - hx, wz - hz, wx + hx, wz + hz);
        if (dist !== null && dist > 0 && dist < closestDist) closestDist = dist;
      }
    }

    this.game.players.forEach((player, id) => {
      if (id === ownerId || !player.alive) return;
      const rewindPos = requestTime ? this._getPositionAt(id, requestTime) : null;
      const px = rewindPos ? rewindPos.pos.x : player.position.x;
      const pz = rewindPos ? rewindPos.pos.z : player.position.z;
      const dx = px - origin.x;
      const dz = pz - origin.z;
      const t = dx * dir.x + dz * dir.z;
      if (t < 0 || t > closestDist) return;
      const dist = Math.sqrt(
        (origin.x + dir.x * t - px) ** 2 + (origin.z + dir.z * t - pz) ** 2
      );
      if (dist < hitRadius && t < closestDist) { closestDist = t; hitPlayer = id; }
    });

    endPos.x = origin.x + dir.x * closestDist;
    endPos.z = origin.z + dir.z * closestDist;
    return { endPos, hitPlayer, distance: closestDist };
  }

  _rayAABB2D(origin, dir, xmin, zmin, xmax, zmax) {
    const invDx = dir.x !== 0 ? 1 / dir.x : 1e16;
    const invDz = dir.z !== 0 ? 1 / dir.z : 1e16;
    let tmin = -Infinity, tmax = Infinity;
    const tx1 = (xmin - origin.x) * invDx;
    const tx2 = (xmax - origin.x) * invDx;
    tmin = Math.max(tmin, Math.min(tx1, tx2));
    tmax = Math.min(tmax, Math.max(tx1, tx2));
    const tz1 = (zmin - origin.z) * invDz;
    const tz2 = (zmax - origin.z) * invDz;
    tmin = Math.max(tmin, Math.min(tz1, tz2));
    tmax = Math.min(tmax, Math.max(tz1, tz2));
    if (tmax < tmin || tmax < 0) return null;
    return tmin < 0 ? tmax : tmin;
  }

  /* ============ HIT DETECTION (Lag Compensation) ============ */
  processHit(proj, victimId, weapon) {
    const hitKey = proj.id + '_' + victimId;
    if (this._hitThisTick.has(hitKey)) return;
    this._hitThisTick.add(hitKey);

    const wp = this._getWp(weapon) || WEAPONS.pistol;
    const victim = this.game.players.get(victimId);
    if (!victim || !victim.alive) return;
    const killerId = proj.ownerId;
    if (victimId === this.game.network.myId && this.game.invincibleTimer > 0) return;

    let damage = wp.damage;
    const passive = this.game.passiveManager;
    if (passive) {
      damage *= passive.getDamageMultiplier(killerId);
      if (passive.isCritical(killerId)) damage *= passive.getCriticalDamageMultiplier(killerId);
    }
    const dmgReduction = passive ? passive.getDamageReduction(victimId, 'projectile') : 1;
    damage *= dmgReduction;
    if (proj.executionerThreshold && victim.health > 0 &&
        (victim.health / victim.maxHealth) < proj.executionerThreshold) {
      damage *= proj.executionerDamageMult || 1.3;
    }

    const killed = victim.takeDamage(Math.round(damage));

    if (proj.lifeSteal) {
      const shooter = this.game.players.get(killerId);
      if (shooter && shooter.alive) shooter.health = Math.min(shooter.health + damage * proj.lifeSteal, shooter.maxHealth);
    }

    const hitMsg = {
      type: 'hit', shooterId: killerId, targetId: victimId,
      damage: Math.round(damage),
      shooterName: (this.game.players.get(killerId) || {}).name || '?',
      targetName: victim.name, lethal: killed, weapon,
      pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
    };
    this.game.network.broadcast(hitMsg);
    const cv = this.game.cheatValidator;
    if (cv) cv.trackDamage(victimId, Math.round(damage));
    if (killed) this._trackKill(killerId, victimId, weapon);
    if (victimId === this.game.network.myId) this.game._applyLocalHitEffects(hitMsg);
  }

  /* ============ EXPLOSION ============ */
  processExplosion(proj, hitPlayers) {
    const wp = proj.wp || this._getWp(proj.weapon) || WEAPONS.pistol;
    _v3a.copy(proj.mesh.position);
    const passive = this.game.passiveManager;
    const explosionData = {
      damage: wp.damage, radius: proj.explosionRadius || wp.explosionRadius || 2.5,
    };
    if (passive) passive.applyToExplosion(explosionData, proj.ownerId);
    const radiusMult = explosionData.radius / (wp.explosionRadius || 2.5);

    this.game.players.forEach((victim, id) => {
      if (id === proj.ownerId || !victim.alive || hitPlayers.has(id)) return;
      hitPlayers.add(id);
      if (id === this.game.network.myId && this.game.invincibleTimer > 0) return;
      const hitDist = (CONFIG.playerSize * 0.5 + (wp.hitRadius || 2.5)) * radiusMult;
      _v3c.set(victim.position.x, CONFIG.playerHeight / 2, victim.position.z);
      if (_v3a.distanceTo(_v3c) < hitDist) {
        let expDamage = explosionData.damage;
        if (passive) expDamage *= passive.getDamageReduction(id, 'explosion');
        const killed = victim.takeDamage(Math.round(expDamage));
        const hitMsg = {
          type: 'hit', shooterId: proj.ownerId, targetId: id,
          damage: Math.round(expDamage),
          shooterName: (this.game.players.get(proj.ownerId) || {}).name || '?',
          targetName: victim.name, lethal: killed, weapon: proj.weapon,
          pos: { x: _v3a.x, y: _v3a.y, z: _v3a.z }, explosive: true,
        };
        this.game.network.broadcast(hitMsg);
        const cv = this.game.cheatValidator;
        if (cv) cv.trackDamage(id, Math.round(expDamage));
        if (killed) this._trackKill(proj.ownerId, id, proj.weapon);
        if (id === this.game.network.myId) this.game._applyLocalHitEffects(hitMsg);
      }
    });
  }

  _trackKill(shooterId, victimId, weapon) {
    this.game._trackKill(shooterId, victimId, weapon);
  }

  _explodeProjectile(proj) {
    if (!((proj.wp && proj.wp.explosive) || proj.explosiveAmmo)) return;
    this.processExplosion(proj, proj.hitPlayers);
    _v3a.copy(proj.mesh.position);
    if (AUDIO) AUDIO.play('explosion', { position: _v3a });
    this.game.effectManager.spawnExplosion(_v3a, proj.color || 0xff4400);
    this.game.network.broadcast({
      type: 'explosion',
      pos: { x: _v3a.x, y: _v3a.y, z: _v3a.z },
      color: proj.color || 0xff4400, weapon: proj.weapon, pid: proj.id,
    });
  }

  _spawnGravityZone(pos, ownerId, color) {
    const zone = {
      position: _v3c.copy(pos), ownerId,
      color: color || 0x2200aa, age: 0, duration: 4, radius: 8,
      pullStrength: 8, damageTick: 5, tickInterval: 1, lastTick: 0,
    };
    this._gravityZones.push(zone);
    this.game.network.broadcast({
      type: 'gravity_zone', pos: { x: pos.x, y: 0, z: pos.z },
      color: zone.color, duration: zone.duration, radius: zone.radius,
    });
    if (AUDIO) AUDIO.play('explosion', { position: pos });
    this.game.effectManager.spawnExplosion(_v3a.copy(pos), zone.color);
  }

  _fireDroneMissile(droneProj) {
    const target = this._findNearestEnemy(droneProj.mesh.position, droneProj.ownerId);
    if (!target) return;
    _v3a.copy(droneProj.mesh.position);
    _v3b.set(target.position.x - _v3a.x, 0, target.position.z - _v3a.z).normalize();
    const pid = 'drone_' + (this._projIdCounter++);
    const missile = new Projectile(this.game.scene, _v3a, _v3b, droneProj.ownerId, pid, 0xff4444, 'missile_drone');
    missile.speed = 30;
    missile.velocity.copy(_v3b).multiplyScalar(30);
    missile.isHoming = true; missile.homingTargetId = target.id;
    missile.wp.damage = 20; missile.wp.hitRadius = 0.6; missile.wp.projLifetime = 5;
    missile.isHostProjectile = true;
    this.hostProjectiles.push(missile);
    this.game.network.broadcast({
      type: 'proj_spawn', ownerId: droneProj.ownerId, pid, weapon: 'missile_drone',
      pos: { x: _v3a.x, y: 0, z: _v3a.z },
      dir: { x: _v3b.x, y: 0, z: _v3b.z }, color: 0xff4444,
      inputId: pid, homing: true, homingTarget: target.id,
    });
  }

  _findNearestEnemy(pos, ownerId) {
    let nearest = null, nearDist = Infinity;
    this.game.players.forEach((p, id) => {
      if (id === ownerId || !p.alive) return;
      const d = pos.distanceTo(p.position);
      if (d < nearDist) { nearDist = d; nearest = p; }
    });
    return nearest;
  }

  _updateGravityZones(dt) {
    for (let i = this._gravityZones.length - 1; i >= 0; i--) {
      const z = this._gravityZones[i];
      z.age += dt;
      if (z.age >= z.duration) { this._gravityZones.splice(i, 1); continue; }
      z.lastTick += dt;
      const tickDamage = z.lastTick >= z.tickInterval;
      this.game.players.forEach((p, id) => {
        if (id === z.ownerId || !p.alive) return;
        const dx = z.position.x - p.position.x;
        const dz = z.position.z - p.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < z.radius && dist > 0.1) {
          const force = z.pullStrength * (1 - dist / z.radius) * dt;
          p.position.x += (dx / dist) * force;
          p.position.z += (dz / dist) * force;
          p.targetPosition.copy(p.position);
          if (tickDamage) {
            z.lastTick = 0;
            p.takeDamage(z.damageTick);
            if (!p.alive) this._trackKill(z.ownerId, id, 'black_hole_launcher');
          }
        }
      });
    }
  }

  /* ============ AMMO / HEAT ============ */
  _hasAmmo(peerId, weapon) {
    const wp = this._getWp(weapon);
    if (!wp) return false;
    if (wp.weaponType === 'energy') return !this._getHeatState(peerId, weapon).overheated;
    if (wp.weaponType === 'beam') {
      const hs = this._getHeatState(peerId, weapon);
      if (hs.overheated) return false;
      const state = this.getAmmoState(peerId, weapon);
      return state && state.ammo > 0;
    }
    const state = this.getAmmoState(peerId, weapon);
    return state && state.ammo > 0;
  }

  _consumeAmmo(peerId, weapon) {
    const wp = this._getWp(weapon);
    if (!wp) return;
    if (wp.weaponType === 'energy' || wp.weaponType === 'beam') {
      const hs = this._getHeatState(peerId, weapon);
      const heatPerShot = Math.max(1, Math.ceil((wp.heatCapacity || 40) * (wp.fireRate || 0.25) / 1.5));
      hs.heat = Math.min(hs.maxHeat, hs.heat + heatPerShot);
      if (hs.heat >= hs.maxHeat) hs.overheated = true;
      if (wp.weaponType === 'beam') {
        const state = this.getAmmoState(peerId, weapon);
        if (state) state.ammo = Math.max(0, state.ammo - 1);
      }
      return;
    }
    const state = this.getAmmoState(peerId, weapon);
    if (!state) return;
    const cost = this.game.passiveManager ? this.game.passiveManager.getAmmoCost(peerId, 1) : 1;
    state.ammo = Math.max(0, state.ammo - cost);
  }

  _getHeatState(peerId, weapon) {
    const key = peerId + '_' + weapon;
    if (!this.heatStates.has(key)) {
      const wp = this._getWp(weapon);
      this.heatStates.set(key, {
        heat: 0, maxHeat: wp ? (wp.heatCapacity || 0) : 0,
        coolingSpeed: wp ? (wp.coolingSpeed || 0) : 0, overheated: false,
      });
    }
    return this.heatStates.get(key);
  }

  getAmmoState(peerId, weapon) {
    const key = peerId + '_' + weapon;
    if (!this.ammoStates.has(key)) {
      const wp = this._getWp(weapon);
      const baseAmmo = wp ? wp.maxAmmo : 10;
      const ammo = this.game.passiveManager ? this.game.passiveManager.getMagazineSize(peerId, baseAmmo) : baseAmmo;
      this.ammoStates.set(key, { ammo, weapon });
    }
    return this.ammoStates.get(key);
  }

  refillAmmo(peerId, weapon) {
    const key = peerId + '_' + weapon;
    const wp = this._getWp(weapon);
    if (wp) {
      const ammo = this.game.passiveManager ? this.game.passiveManager.getMagazineSize(peerId, wp.maxAmmo) : wp.maxAmmo;
      this.ammoStates.set(key, { ammo, weapon });
      if (wp.heatCapacity) {
        this.heatStates.set(key, { heat: 0, maxHeat: wp.heatCapacity, coolingSpeed: wp.coolingSpeed || 0, overheated: false });
      }
    }
    this._sendAmmoUpdate(peerId, weapon);
  }

  refillAllAmmo(peerId) {
    Object.keys(WEAPONS).forEach(key => this.refillAmmo(peerId, key));
  }

  _sendAmmoUpdate(peerId, weapon) {
    const state = this.getAmmoState(peerId, weapon);
    this.game.network.sendTo(peerId, {
      type: 'ammo_update', weapon,
      ammo: state ? state.ammo : 0,
      maxAmmo: this._getWp(weapon) ? this._getWp(weapon).maxAmmo : 10,
    });
  }

  getStats(peerId) {
    if (!this.playerStats.has(peerId)) {
      this.playerStats.set(peerId, { kills: 0, deaths: 0 });
    }
    return this.playerStats.get(peerId);
  }

  /* ============ HOST PROJECTILE UPDATE ============ */
  handleHostProjectiles(dt) {
    this.heatStates.forEach((state) => {
      if (state.heat > 0) {
        state.heat = Math.max(0, state.heat - (state.coolingSpeed || 15) * dt);
        if (state.overheated && state.heat <= 0) state.overheated = false;
      }
    });

    this._updateGravityZones(dt);
    this._hitThisTick.clear();

    const projs = this.hostProjectiles;
    for (let i = projs.length - 1; i >= 0; i--) {
      const proj = projs[i];
      if (!proj.alive) {
        if (proj.weapon === 'missile_drone') this._drones.delete(proj.id);
        projs.splice(i, 1);
        continue;
      }

      proj.update(dt);

      if (!proj.alive && proj.weapon === 'black_hole_launcher') {
        this._spawnGravityZone(proj.mesh.position, proj.ownerId, proj.color);
      }

      if (proj.alive && proj.isHoming && proj.homingTargetId) {
        const target = this.game.players.get(proj.homingTargetId);
        if (target && target.alive) {
          _v3c.set(target.position.x - proj.mesh.position.x, 0, target.position.z - proj.mesh.position.z);
          const dist = _v3c.length();
          if (dist > 0.5) { _v3c.normalize(); proj.velocity.lerp(_v3c.multiplyScalar(proj.speed), dt * proj.homingStrength); proj.velocity.y = 0; }
        } else { proj.homingTargetId = null; }
      }

      if (proj.alive && proj.weapon === 'missile_drone' && !proj.isHoming) {
        if (proj.age > 0.5 && proj.velocity.lengthSq() > 0.01) { proj.velocity.set(0, 0, 0); this._drones.set(proj.id, { fireTimer: 1.5 }); }
        const drone = this._drones.get(proj.id);
        if (drone) { drone.fireTimer -= dt; if (drone.fireTimer <= 0) { drone.fireTimer = 1.5; this._fireDroneMissile(proj); } }
      }

      const map = this.game.arenaMap;
      if (map) {
        const half = map.size / 2;
        const walls = map.walls || [];
        const pr = 0.2;
        if (Math.abs(proj.mesh.position.x) > half || Math.abs(proj.mesh.position.z) > half) {
          this._explodeProjectile(proj); proj.destroy(); continue;
        }
        for (let wi = 0; wi < walls.length; wi++) {
          const w = walls[wi], wx = w.p[0], wz = w.p[2];
          const wHalfX = w.s[0] / 2 + pr, wHalfZ = w.s[2] / 2 + pr;
          if (Math.abs(proj.mesh.position.x - wx) < wHalfX && Math.abs(proj.mesh.position.z - wz) < wHalfZ) {
            if (proj.ricochetCount > 0) {
              proj.ricochetCount--; proj.ricocheted = true;
              const ox = wHalfX - Math.abs(proj.mesh.position.x - wx);
              const oz = wHalfZ - Math.abs(proj.mesh.position.z - wz);
              if (ox < oz) { proj.velocity.x *= -1; proj.mesh.position.x += (proj.mesh.position.x > wx ? 1 : -1) * ox; }
              else { proj.velocity.z *= -1; proj.mesh.position.z += (proj.mesh.position.z > wz ? 1 : -1) * oz; }
            } else { this._explodeProjectile(proj); proj.destroy(); }
            break;
          }
        }
      }

      if (!proj.alive) continue;

      this.game.players.forEach((victim, id) => {
        if (id === proj.ownerId || !victim.alive || proj.hitPlayers.has(id)) return;
        const hitDist = (CONFIG.playerSize * 0.5 + ((proj.wp && proj.wp.hitRadius) || 0.8)) * (proj.passiveSizeMult || 1);
        _v3c.set(victim.position.x, CONFIG.playerHeight / 2, victim.position.z);
        if (proj.mesh.position.distanceTo(_v3c) < hitDist) {
          proj.hitPlayers.add(id);
          if ((proj.wp && proj.wp.explosive) || proj.explosiveAmmo) {
            this.processHit(proj, id, proj.weapon);
            this._explodeProjectile(proj);
          } else {
            this.processHit(proj, id, proj.weapon);
            _v3a.copy(proj.mesh.position);
            this.game.effectManager.spawnHitEffect(_v3a, proj.color || 0xffffff);
            this.game.network.broadcast({
              type: 'hit_effect',
              pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
              color: proj.color || 0xffffff, pid: proj.id,
            });
          }
          if (proj.pierceCount > 0) proj.pierceCount--;
          else proj.destroy();
        }
      });
    }
  }

  reset() {
    this.hostProjectiles.forEach(p => p.destroy());
    this.hostProjectiles = [];
    this.projIdCounter = 0;
    this.ammoStates.clear();
    this.heatStates.clear();
    this.playerStats.clear();
    this.respawnedPeers.clear();
    this._gravityZones = [];
    this._drones.clear();
    this._projIdCounter = 0;
    this._projIdSet.clear();
    this._hitThisTick.clear();
    this._processedInputs.clear();
    this._positionHistory.clear();
    this._pendingInputs.clear();
  }
}
