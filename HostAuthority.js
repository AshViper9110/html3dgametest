class HostAuthority {
  constructor(game) {
    this.game = game;
    this.hostProjectiles = [];
    this.projIdCounter = 0;
    this.ammoStates = new Map();
    this.playerStats = new Map();
  }

  handleFireRequest(data, peerId, inputId) {
    const cv = this.game.cheatValidator;
    if (!cv) return;

    if (!cv.validateWeapon(data.weapon)) return;
    if (!cv.validateFireRate(peerId, data.weapon, data.timestamp || performance.now())) return;
    if (!cv.isReplayAttack(inputId)) return;
    if (!this._hasAmmo(peerId, data.weapon)) return;

    this._consumeAmmo(peerId, data.weapon);

    const wp = WEAPONS[data.weapon];
    const pellets = wp.pellets || 1;
    const spawnPos = new THREE.Vector3(data.position.x, 0, data.position.z);

    for (let i = 0; i < pellets; i++) {
      const dir = new THREE.Vector3(data.direction.x, 0, data.direction.z);
      if (i > 0 && wp.spread > 0) {
        dir.x += (Math.random() - 0.5) * wp.spread;
        dir.z += (Math.random() - 0.5) * wp.spread;
        dir.normalize();
      }
      const pid = peerId + '_h' + (this.projIdCounter++);

      const proj = new Projectile(this.game.scene, spawnPos, dir, peerId, pid, data.color || 0xffffff, data.weapon);
      proj.isHostProjectile = true;
      this.hostProjectiles.push(proj);

      this._broadcastProjectile(peerId, pid, data.weapon, data.position, dir, data.color || 0xffffff, inputId);
    }

    this._sendAmmoUpdate(peerId, data.weapon);
  }

  _broadcastProjectile(ownerId, pid, weapon, pos, dir, color, inputId) {
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
    if (state) state.ammo = Math.max(0, state.ammo - 1);
  }

  getAmmoState(peerId, weapon) {
    const key = peerId + '_' + weapon;
    if (!this.ammoStates.has(key)) {
      const wp = WEAPONS[weapon];
      this.ammoStates.set(key, { ammo: wp ? wp.maxAmmo : 10, weapon });
    }
    return this.ammoStates.get(key);
  }

  refillAmmo(peerId, weapon) {
    const key = peerId + '_' + weapon;
    const wp = WEAPONS[weapon];
    if (wp) {
      this.ammoStates.set(key, { ammo: wp.maxAmmo, weapon });
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
    const killed = victim.takeDamage(wp.damage);

    const hitMsg = {
      type: 'hit',
      shooterId: killerId,
      targetId: victimId,
      damage: wp.damage,
      shooterName: killer ? killer.name : '?',
      targetName: victim.name,
      lethal: killed,
      weapon,
      pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
    };

    this.game.network.broadcast(hitMsg);

    if (killed) {
      this._trackKill(killerId, victimId);
    }
    proj.destroy();
  }

  processExplosion(proj, hitPlayers) {
    const wp = proj.wp || WEAPONS[proj.weapon] || WEAPONS.pistol;
    const pos = proj.mesh.position.clone();

    this.game.players.forEach((victim, id) => {
      if (id === proj.ownerId || !victim.alive) return;
      if (hitPlayers.has(id)) return;
      hitPlayers.add(id);

      const hitDist = CONFIG.playerSize * 0.5 + (wp.hitRadius || 2.5);
      const vPos = new THREE.Vector3(victim.position.x, CONFIG.playerHeight / 2, victim.position.z);
      const dist = pos.distanceTo(vPos);

      if (dist < hitDist) {
        const killer = this.game.players.get(proj.ownerId);
        const killed = victim.takeDamage(wp.damage);

        this.game.network.broadcast({
          type: 'hit',
          shooterId: proj.ownerId,
          targetId: id,
          damage: wp.damage,
          shooterName: killer ? killer.name : '?',
          targetName: victim.name,
          lethal: killed,
          weapon: proj.weapon,
          pos: { x: pos.x, y: pos.y, z: pos.z },
          explosive: true,
        });

        if (killed) {
          this._trackKill(proj.ownerId, id);
        }
      }
    });
  }

  _trackKill(shooterId, victimId) {
    this.game._trackKill(shooterId, victimId);
  }

  handleHostProjectiles(dt) {
    for (let i = this.hostProjectiles.length - 1; i >= 0; i--) {
      const proj = this.hostProjectiles[i];
      if (!proj.alive) {
        this.hostProjectiles.splice(i, 1);
        continue;
      }

      proj.update(dt);

      const map = this.game.arenaMap;
      if (map) {
        const half = map.size / 2;
        const walls = map.walls || [];
        const allWalls = [...walls];
        if (Math.abs(proj.mesh.position.x) > half || Math.abs(proj.mesh.position.z) > half) {
          if (proj.wp && proj.wp.explosive) {
            this.processExplosion(proj, proj.hitPlayers);
            this.game.effectManager.spawnExplosion(
              proj.mesh.position.clone(),
              proj.color || 0xff4400,
              proj.weapon
            );
            this.game.effectManager.spawnExplosionFX(proj.mesh.position.clone(), proj.color || 0xff4400);
            this.game.network.broadcast({
              type: 'explosion',
              pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
              color: proj.color || 0xff4400,
              weapon: proj.weapon,
            });
          }
          proj.destroy();
          continue;
        }
        for (const w of allWalls) {
          const wx = w.p[0], wz = w.p[2];
          const wHalfX = w.s[0] / 2 + CONFIG.projectileRadius;
          const wHalfZ = w.s[2] / 2 + CONFIG.projectileRadius;
          if (Math.abs(proj.mesh.position.x - wx) < wHalfX && Math.abs(proj.mesh.position.z - wz) < wHalfZ) {
            if (proj.wp && proj.wp.explosive) {
              this.processExplosion(proj, proj.hitPlayers);
              this.game.effectManager.spawnExplosion(
                proj.mesh.position.clone(),
                proj.color || 0xff4400,
                proj.weapon
              );
              this.game.effectManager.spawnExplosionFX(proj.mesh.position.clone(), proj.color || 0xff4400);
              this.game.network.broadcast({
                type: 'explosion',
                pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
                color: proj.color || 0xff4400,
                weapon: proj.weapon,
              });
            }
            proj.destroy();
            break;
          }
        }
      }

      if (!proj.alive) continue;

      this.game.players.forEach((victim, id) => {
        if (id === proj.ownerId || !victim.alive || proj.hitPlayers.has(id)) return;
        const hitDist = CONFIG.playerSize * 0.5 + ((proj.wp && proj.wp.hitRadius) || 0.8);
        const vPos = new THREE.Vector3(victim.position.x, CONFIG.playerHeight / 2, victim.position.z);
        if (proj.mesh.position.distanceTo(vPos) < hitDist) {
          proj.hitPlayers.add(id);

          if (proj.wp && proj.wp.explosive) {
            this.processExplosion(proj, proj.hitPlayers);
            this.game.effectManager.spawnExplosion(
              proj.mesh.position.clone(),
              proj.color || 0xff4400,
              proj.weapon
            );
            this.game.effectManager.spawnExplosionFX(proj.mesh.position.clone(), proj.color || 0xff4400);
            this.game.network.broadcast({
              type: 'explosion',
              pos: { x: proj.mesh.position.x, y: proj.mesh.position.y, z: proj.mesh.position.z },
              color: proj.color || 0xff4400,
              weapon: proj.weapon,
            });
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
            });
          }
          proj.destroy();
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

  reset() {
    this.hostProjectiles.forEach(p => p.destroy());
    this.hostProjectiles = [];
    this.projIdCounter = 0;
    this.ammoStates.clear();
    this.playerStats.clear();
  }
}
