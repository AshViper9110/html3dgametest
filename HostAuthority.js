class HostAuthority {
  constructor(game) {
    this.game = game;
    this.hostProjectiles = [];
    this.projIdCounter = 0;
    this.ammoStates = new Map();
    this.playerStats = new Map();
    this.respawnedPeers = new Set();
  }

  handleFireRequest(data, peerId, inputId) {
    console.log('[Host Authority] handleFireRequest peerId=%s weapon=%s inputId=%s', peerId, data.weapon, inputId);
    const cv = this.game.cheatValidator;
    const cm = this.game.cheatManager;

    const r = cv.validateFireRate(peerId, data.weapon, data.timestamp || Date.now());
    if (!r.ok) { console.log('[Host Authority] BLOCKED: validateFireRate'); if (cm) cm.report(peerId, r.reason); return; }
    if (this.respawnedPeers.has(peerId)) {
      console.log('[Host Authority] respawnedPeers → refillAllAmmo');
      this.refillAllAmmo(peerId);
      this.respawnedPeers.delete(peerId);
    }
    const ammoState = this.getAmmoState(peerId, data.weapon);
    console.log('[Host Authority] ammo for %s/%s: ammo=%d maxAmmo=%d', peerId, data.weapon, ammoState ? ammoState.ammo : '?', ammoState ? ammoState.maxAmmo : '?');
    if (!this._hasAmmo(peerId, data.weapon)) {
      console.log('[Host Authority] BLOCKED: _hasAmmo false (no ammo for %s)', data.weapon);
      return;
    }
    console.log('[Host Authority] _hasAmmo OK → consume + spawn projectile');

    this._consumeAmmo(peerId, data.weapon);

    const wp = WEAPONS[data.weapon];
    const pellets = wp.pellets || 1;
    const spawnPos = new THREE.Vector3(data.position.x, 0, data.position.z);
    const mapHalf = this.game.arenaMap ? this.game.arenaMap.size / 2 : 40;

    for (let i = 0; i < pellets; i++) {
      const dir = new THREE.Vector3(data.direction.x, 0, data.direction.z);
      if (i > 0 && wp.spread > 0) {
        dir.x += (Math.random() - 0.5) * wp.spread;
        dir.z += (Math.random() - 0.5) * wp.spread;
        dir.normalize();
      }
      const pid = peerId + '_h' + (this.projIdCounter++);

      const proj = new Projectile(this.game.scene, spawnPos, dir, peerId, pid, data.color || 0xffffff, data.weapon, mapHalf);
      if (this.game.passiveManager) {
        this.game.passiveManager.applyToProjectile(proj, peerId);
      }
      proj.isHostProjectile = true;
      this.hostProjectiles.push(proj);

      this._broadcastProjectile(peerId, pid, data.weapon, data.position, dir, data.color || 0xffffff, inputId);
    }

    this._sendAmmoUpdate(peerId, data.weapon);
  }

  _broadcastProjectile(ownerId, pid, weapon, pos, dir, color, inputId) {
    console.log('[Projectile Broadcast] ownerId=%s pid=%s weapon=%s to %d connections',
      ownerId, pid, weapon, this.game.network.connections.filter(c => c.open).length);
    this.game.network.broadcast({
      type: 'proj_spawn',
      ownerId, pid, weapon,
      pos: { x: pos.x, y: 0, z: pos.z },
      dir: { x: dir.x, y: 0, z: dir.z },
      color, inputId,
    });
  }

  _hasAmmo(peerId, weapon) {
    const state = this.getAmmoState(peerId, weapon);
    return state && state.ammo > 0;
  }

  _consumeAmmo(peerId, weapon) {
    const state = this.getAmmoState(peerId, weapon);
    if (!state) return;
    const cost = this.game.passiveManager ? this.game.passiveManager.getAmmoCost(peerId, 1) : 1;
    state.ammo = Math.max(0, state.ammo - cost);
  }

  getAmmoState(peerId, weapon) {
    const key = peerId + '_' + weapon;
    if (!this.ammoStates.has(key)) {
      const wp = WEAPONS[weapon];
      const baseAmmo = wp ? wp.maxAmmo : 10;
      const ammo = this.game.passiveManager ? this.game.passiveManager.getMagazineSize(peerId, baseAmmo) : baseAmmo;
      this.ammoStates.set(key, { ammo, weapon });
    }
    return this.ammoStates.get(key);
  }

  refillAmmo(peerId, weapon) {
    const key = peerId + '_' + weapon;
    const wp = WEAPONS[weapon];
    if (wp) {
      const ammo = this.game.passiveManager ? this.game.passiveManager.getMagazineSize(peerId, wp.maxAmmo) : wp.maxAmmo;
      this.ammoStates.set(key, { ammo, weapon });
    }
    this._sendAmmoUpdate(peerId, weapon);
  }

  refillAllAmmo(peerId) {
    Object.keys(WEAPONS).forEach(key => {
      this.refillAmmo(peerId, key);
    });
  }

  _sendAmmoUpdate(peerId, weapon) {
    const state = this.getAmmoState(peerId, weapon);
    this.game.network.sendTo(peerId, {
      type: 'ammo_update',
      weapon,
      ammo: state ? state.ammo : 0,
      maxAmmo: WEAPONS[weapon] ? WEAPONS[weapon].maxAmmo : 10,
    });
  }

  processHit(proj, victimId, weapon) {
    const wp = WEAPONS[weapon] || WEAPONS.pistol;
    const victim = this.game.players.get(victimId);
    if (!victim || !victim.alive) return;

    const killerId = proj.ownerId;
    const killer = this.game.players.get(killerId);

    if (victimId === this.game.network.myId && this.game.invincibleTimer > 0) {
      proj.destroy();
      return;
    }

    let damage = wp.damage;
    const passive = this.game.passiveManager;
    if (passive) {
      damage *= passive.getDamageMultiplier(killerId);
      if (passive.isCritical(killerId)) {
        damage *= passive.getCriticalDamageMultiplier(killerId);
      }
      const expMult = passive.getExplosionDamageMultiplier(killerId);
      if (proj.wp && proj.wp.explosive) {
        damage *= expMult;
      }
    }
    const dmgReduction = passive ? passive.getDamageReduction(victimId, 'projectile') : 1;
    damage *= dmgReduction;
    const killed = victim.takeDamage(damage);

    if (passive) {
      passive.onDamageDealt(killerId, victimId, damage, weapon);
    }

    const hitMsg = {
      type: 'hit',
      shooterId: killerId,
      targetId: victimId,
      damage,
      shooterName: killer ? killer.name : '?',
      targetName: victim.name,
      lethal: killed,
      weapon,
      pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
    };

    this.game.network.broadcast(hitMsg);

    if (killed) {
      this._trackKill(killerId, victimId, weapon);
    }

    if (victimId === this.game.network.myId) {
      this.game._applyLocalHitEffects(hitMsg);
    }

    proj.destroy();
  }

  processExplosion(proj, hitPlayers) {
    const wp = proj.wp || WEAPONS[proj.weapon] || WEAPONS.pistol;
    const pos = proj.mesh.position.clone();
    const passive = this.game.passiveManager;
    const radiusMult = passive ? passive.getExplosionRadius(proj.ownerId, 1) : 1;

    this.game.players.forEach((victim, id) => {
      if (id === proj.ownerId || !victim.alive) return;
      if (hitPlayers.has(id)) return;
      hitPlayers.add(id);

      if (id === this.game.network.myId && this.game.invincibleTimer > 0) return;

      const hitDist = (CONFIG.playerSize * 0.5 + (wp.hitRadius || 2.5)) * radiusMult;
      const vPos = new THREE.Vector3(victim.position.x, CONFIG.playerHeight / 2, victim.position.z);
      const dist = pos.distanceTo(vPos);

      if (dist < hitDist) {
        const killer = this.game.players.get(proj.ownerId);
        let expDamage = wp.damage;
        if (passive) {
          const expMult = passive.getExplosionDamageMultiplier(proj.ownerId);
          expDamage *= expMult;
          expDamage *= passive.getDamageReduction(id, 'explosion');
        }
        const killed = victim.takeDamage(expDamage);

        const hitMsg = {
          type: 'hit',
          shooterId: proj.ownerId,
          targetId: id,
          damage: expDamage,
          shooterName: killer ? killer.name : '?',
          targetName: victim.name,
          lethal: killed,
          weapon: proj.weapon,
          pos: { x: pos.x, y: pos.y, z: pos.z },
          explosive: true,
        };

        this.game.network.broadcast(hitMsg);

        if (killed) {
          this._trackKill(proj.ownerId, id, proj.weapon);
        }

        if (id === this.game.network.myId) {
          this.game._applyLocalHitEffects(hitMsg);
        }
      }
    });
  }

  _trackKill(shooterId, victimId, weapon) {
    this.game._trackKill(shooterId, victimId, weapon);
  }

  _explodeProjectile(proj) {
    if (!proj.wp || !proj.wp.explosive) return;
    this.processExplosion(proj, proj.hitPlayers);
    const pos = proj.mesh.position.clone();
    if (AUDIO) AUDIO.play('explosion', { position: pos });
    this.game.effectManager.spawnExplosion(pos.clone(), proj.color || 0xff4400);
    this.game.network.broadcast({
      type: 'explosion',
      pos: { x: pos.x, y: pos.y, z: pos.z },
      color: proj.color || 0xff4400,
      weapon: proj.weapon,
      pid: proj.id,
    });
  }

  handleHostProjectiles(dt) {
    const projs = this.hostProjectiles;
    for (let i = projs.length - 1; i >= 0; i--) {
      const proj = projs[i];
      if (!proj.alive) { projs.splice(i, 1); continue; }

      proj.update(dt);

      const map = this.game.arenaMap;
      if (map) {
        const half = map.size / 2;
        const walls = map.walls || [];
        const pr = this.game.projectileRadius || CONFIG.projectileRadius;
        if (Math.abs(proj.mesh.position.x) > half || Math.abs(proj.mesh.position.z) > half) {
          this._explodeProjectile(proj);
          proj.destroy();
          continue;
        }
        for (let wi = 0; wi < walls.length; wi++) {
          const w = walls[wi];
          const wx = w.p[0], wz = w.p[2];
          const wHalfX = w.s[0] / 2 + pr;
          const wHalfZ = w.s[2] / 2 + pr;
          if (Math.abs(proj.mesh.position.x - wx) < wHalfX && Math.abs(proj.mesh.position.z - wz) < wHalfZ) {
            if (proj.ricochetCount > 0) {
              proj.ricochetCount--;
              proj.ricocheted = true;
              const overlapX = wHalfX - Math.abs(proj.mesh.position.x - wx);
              const overlapZ = wHalfZ - Math.abs(proj.mesh.position.z - wz);
              if (overlapX < overlapZ) {
                proj.velocity.x *= -1;
                proj.mesh.position.x += (proj.mesh.position.x > wx ? 1 : -1) * overlapX;
              } else {
                proj.velocity.z *= -1;
                proj.mesh.position.z += (proj.mesh.position.z > wz ? 1 : -1) * overlapZ;
              }
            } else {
              this._explodeProjectile(proj);
              proj.destroy();
            }
            break;
          }
        }
      }

      if (!proj.alive) continue;

      const vPos = new THREE.Vector3();
      this.game.players.forEach((victim, id) => {
        if (id === proj.ownerId || !victim.alive || proj.hitPlayers.has(id)) return;
        const hitDist = (CONFIG.playerSize * 0.5 + ((proj.wp && proj.wp.hitRadius) || 0.8)) * (proj.passiveSizeMult || 1);
        vPos.set(victim.position.x, CONFIG.playerHeight / 2, victim.position.z);
        if (proj.mesh.position.distanceTo(vPos) < hitDist) {
          proj.hitPlayers.add(id);

          if (proj.wp && proj.wp.explosive) {
            this.processHit(proj, id, proj.weapon);
            this._explodeProjectile(proj);
          } else {
            this.processHit(proj, id, proj.weapon);
            this.game.effectManager.spawnHitEffect(
              proj.mesh.position.clone(),
              proj.color || 0xffffff
            );
            this.game.network.broadcast({
              type: 'hit_effect',
              pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
              color: proj.color || 0xffffff,
              pid: proj.id,
            });
          }
          if (proj.pierceCount > 0) {
            proj.pierceCount--;
          } else {
            proj.destroy();
          }
        }
      });
    }
  }

  getStats(peerId) {
    if (!this.playerStats.has(peerId)) {
      this.playerStats.set(peerId, { kills: 0, deaths: 0 });
    }
    return this.playerStats.get(peerId);
  }

  handleBeamFireRequest(data, peerId, inputId) {
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

    const wp = WEAPONS[data.weapon];
    const origin = new THREE.Vector3(data.origin.x, 0, data.origin.z);
    const dir = new THREE.Vector3(data.direction.x, 0, data.direction.z).normalize();
    const passive = this.game.passiveManager;
    const maxRange = passive ? passive.getBeamRange(peerId, wp.range || 40) : (wp.range || 40);
    const map = this.game.arenaMap;

    const beamHitRadius = passive ? passive.getBeamWidth(peerId, wp.hitRadius || 0.8) : (wp.hitRadius || 0.8);
    const result = this._beamRaycast(origin, dir, maxRange, map, peerId, wp, beamHitRadius);

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
        const killer = this.game.players.get(killerId);
        let beamDmg = passive ? passive.getBeamDamage(peerId, wp.damage) : wp.damage;
        if (passive) beamDmg *= passive.getDamageReduction(result.hitPlayer, 'beam');
        const killed = victim.takeDamage(beamDmg);

        const hitMsg = {
          type: 'hit',
          shooterId: killerId,
          targetId: result.hitPlayer,
          damage: beamDmg,
          shooterName: killer ? killer.name : '?',
          targetName: victim.name,
          lethal: killed,
          weapon: data.weapon,
          pos: { x: result.endPos.x, y: 0, z: result.endPos.z },
          beam: true,
        };

        this.game.network.broadcast(hitMsg);

        if (killed) {
          this._trackKill(killerId, result.hitPlayer, data.weapon);
        }

        if (result.hitPlayer === this.game.network.myId) {
          this.game._applyLocalHitEffects(hitMsg);
        }

        beamMsg.hitPlayer = result.hitPlayer;
      }
    }

    beamMsg.distance = result.distance;
    this.game.network.broadcast(beamMsg);
    if (this.game.beamManager) {
      this.game._handleBeamEffect(beamMsg);
    }
    this._sendAmmoUpdate(peerId, data.weapon);
  }

  _beamRaycast(origin, dir, maxRange, map, ownerId, wp, customHitRadius) {
    const endPos = { x: origin.x + dir.x * maxRange, z: origin.z + dir.z * maxRange };
    const hitRadius = customHitRadius || wp.hitRadius || 0.8;
    let closestDist = maxRange;
    let hitPlayer = null;

    const half = map ? map.size / 2 : 20;
    const boundaryHits = this._rayAABB2D(origin, dir, -half, -half, half, half);
    if (boundaryHits !== null && boundaryHits > 0 && boundaryHits < closestDist) {
      closestDist = boundaryHits;
    }

    if (map && map.walls) {
      for (const wall of map.walls) {
        const wx = wall.p[0], wz = wall.p[2];
        const hx = wall.s[0] / 2, hz = wall.s[2] / 2;
        const dist = this._rayAABB2D(origin, dir, wx - hx, wz - hz, wx + hx, wz + hz);
        if (dist !== null && dist > 0 && dist < closestDist) {
          closestDist = dist;
        }
      }
    }

    this.game.players.forEach((player, id) => {
      if (id === ownerId || !player.alive) return;
      const dx = player.position.x - origin.x;
      const dz = player.position.z - origin.z;
      const t = dx * dir.x + dz * dir.z;
      if (t < 0) return;
      if (t > closestDist) return;
      const closestX = origin.x + dir.x * t;
      const closestZ = origin.z + dir.z * t;
      const dist = Math.sqrt(
        (closestX - player.position.x) ** 2 +
        (closestZ - player.position.z) ** 2
      );
      if (dist < hitRadius && t < closestDist) {
        closestDist = t;
        hitPlayer = id;
      }
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

    if (tmax < tmin) return null;
    if (tmax < 0) return null;
    return tmin < 0 ? tmax : tmin;
  }

  reset() {
    this.hostProjectiles.forEach(p => p.destroy());
    this.hostProjectiles = [];
    this.projIdCounter = 0;
    this.ammoStates.clear();
    this.playerStats.clear();
    this.respawnedPeers.clear();
  }
}
