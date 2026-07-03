class PassiveManager {
  constructor(game) {
    this.game = game;
    this.playerPassives = new Map();
    this.playerModifiers = new Map();
    this.activeBuffs = new Map();
    this.regenTimers = new Map();
  }

  setPassive(playerId, passiveId) {
    this.playerPassives.set(playerId, passiveId);
  }

  getPassive(playerId) {
    return this.playerPassives.get(playerId) || 'runner';
  }

  getPassiveData(playerId) {
    const id = this.getPassive(playerId);
    return PASSIVES[id] || PASSIVES.runner;
  }

  getModifiers(playerId) {
    let mods = this.playerModifiers.get(playerId);
    if (!mods) {
      mods = this._computeModifiers(playerId);
      this.playerModifiers.set(playerId, mods);
    }
    return mods;
  }

  _computeModifiers(playerId) {
    const out = {};
    const passiveId = this.getPassive(playerId);
    const data = PASSIVES[passiveId];
    if (!data || !data.modifiers) return out;
    Object.assign(out, data.modifiers);
    const buff = this.activeBuffs.get(playerId);
    if (buff) {
      for (const key of Object.keys(buff)) {
        const bv = buff[key];
        const ov = out[key];
        if (typeof bv === 'number' && typeof ov === 'number') {
          out[key] = ov * bv;
        } else {
          out[key] = bv;
        }
      }
    }
    const player = this.game.players.get(playerId);
    if (player && player.alive) {
      const hpRatio = player.health / player.maxHealth;
      const threshold = out.lowHealthThreshold;
      if (threshold && hpRatio <= threshold) {
        if (out.lowHealthDamageMult) {
          out.damageMultiplier = (out.damageMultiplier || 1) * out.lowHealthDamageMult;
        }
        if (out.lowHealthSpeedMult) {
          out.moveSpeed = (out.moveSpeed || 1) * out.lowHealthSpeedMult;
        }
      }
    }
    return out;
  }

  invalidate(playerId) {
    this.playerModifiers.delete(playerId);
  }

  applyToPlayer(playerId) {
    const player = this.game.players.get(playerId);
    if (!player) return;
    const mods = this.getModifiers(playerId);
    player.passiveId = this.getPassive(playerId);

    if (mods.maxHealthFlat) {
      const oldMax = player.maxHealth;
      player.maxHealth = CONFIG.maxHealth + mods.maxHealthFlat;
      const diff = player.maxHealth - oldMax;
      if (diff > 0) {
        player.health = Math.min(player.health + diff, player.maxHealth);
      }
    }
    player.moveSpeedMult = mods.moveSpeed || 1;
    player.dashSpeedMult = mods.dashSpeed || 1;
    player.damageMult = mods.damageMultiplier || 1;
    player.fireRateMult = mods.fireRateMultiplier || 1;
    player.reloadMult = mods.reloadMultiplier || 1;
    player.recoilMult = mods.recoilMultiplier || 1;
    player.spreadMult = mods.spreadMultiplier || 1;
    player.activePassiveMods = mods;

    if (mods.postRespawnDmgReduction && player.postRespawnTimer > 0) {
      player.damageReduction = mods.postRespawnDmgReduction;
    } else {
      player.damageReduction = 1;
    }
  }

  clearPassive(playerId) {
    const player = this.game.players.get(playerId);
    if (!player) return;
    player.passiveId = null;
    player.moveSpeedMult = 1;
    player.dashSpeedMult = 1;
    player.damageMult = 1;
    player.fireRateMult = 1;
    player.reloadMult = 1;
    player.recoilMult = 1;
    player.spreadMult = 1;
    player.damageReduction = 1;
    player.activePassiveMods = {};
    this.playerModifiers.delete(playerId);
    this.activeBuffs.delete(playerId);
  }

  applyToProjectile(proj, ownerId) {
    if (!proj) return;
    const mods = this.getModifiers(ownerId);
    if (mods.projSpeedMultiplier) {
      proj.velocity.multiplyScalar(mods.projSpeedMultiplier);
      proj.passiveSpeedMult = mods.projSpeedMultiplier;
    }
    if (mods.projSizeMultiplier) {
      proj.passiveSizeMult = mods.projSizeMultiplier;
    }
    proj.ricochetCount = (proj.ricochetCount || 0) + (mods.ricochetCount || 0);
    proj.pierceCount = (proj.pierceCount || 0) + (mods.pierceCount || 0);
    proj.passiveDamageMult = mods.damageMultiplier || 1;
    proj.passiveCritChance = mods.criticalChance || 0;
    proj.passiveCritDamage = mods.criticalDamageMultiplier || 2;
    proj.passiveLifeSteal = mods.lifeSteal || 0;
    proj.ownerPassiveMods = mods;
  }

  getBeamRange(ownerId, baseRange) {
    const mods = this.getModifiers(ownerId);
    return baseRange * (mods.beamRangeMultiplier || 1);
  }

  getBeamDamage(ownerId, baseDamage) {
    const mods = this.getModifiers(ownerId);
    const dmg = baseDamage * (mods.damageMultiplier || 1) * (mods.beamDamageMultiplier || 1);
    return dmg;
  }

  getBeamDuration(ownerId, baseDuration) {
    const mods = this.getModifiers(ownerId);
    return baseDuration * (mods.beamDurationMultiplier || 1);
  }

  getBeamWidth(ownerId, baseWidth) {
    const mods = this.getModifiers(ownerId);
    return baseWidth * (mods.beamWidthMultiplier || 1);
  }

  getBeamSpread(ownerId, baseSpread) {
    const mods = this.getModifiers(ownerId);
    return baseSpread * (mods.beamSpreadMultiplier || 1);
  }

  getExplosionRadius(ownerId, baseRadius) {
    const mods = this.getModifiers(ownerId);
    return baseRadius * (mods.explosionRadiusMultiplier || 1);
  }

  getExplosionDamageMultiplier(ownerId) {
    const mods = this.getModifiers(ownerId);
    return (mods.explosiveDamageMultiplier || 1) * (mods.explosionDamageMultiplier || 1);
  }

  getDamageReduction(victimId, damageType) {
    const mods = this.getModifiers(victimId);
    let reduction = 1;
    if (damageType === 'explosion' && mods.explosionDamageReduction) {
      reduction *= mods.explosionDamageReduction;
    }
    const player = this.game.players.get(victimId);
    if (player && player.damageReduction) {
      reduction *= player.damageReduction;
    }
    return reduction;
  }

  getAmmoCost(ownerId, baseCost) {
    const mods = this.getModifiers(ownerId);
    const cost = baseCost * (mods.ammoCostMultiplier || 1);
    return Math.max(0, Math.round(cost));
  }

  getMagazineSize(ownerId, baseSize) {
    const mods = this.getModifiers(ownerId);
    return Math.round(baseSize * (mods.magazineMultiplier || 1));
  }

  getMaxAmmo(ownerId, baseAmmo) {
    const mods = this.getModifiers(ownerId);
    return Math.round(baseAmmo * (mods.ammoMultiplier || 1));
  }

  reloadPlayerAmmo(playerId) {
    const player = this.game.players.get(playerId);
    if (!player) return;
    const mods = this.getModifiers(playerId);
    const wp = WEAPONS[player.weapon];
    if (!wp) return;
    player.maxAmmo = this.getMagazineSize(playerId, wp.maxAmmo || wp.magazineSize || 10);
    player.ammo = player.maxAmmo;
  }

  onKill(shooterId, targetId, weapon) {
    const mods = this.getModifiers(shooterId);
    if (mods.ammoRegenOnKill) {
      const player = this.game.players.get(shooterId);
      if (player) {
        const wp = WEAPONS[player.weapon];
        const maxAmmo = wp ? (wp.maxAmmo || wp.magazineSize || 10) : 10;
        player.ammo = Math.min(player.ammo + Math.round(maxAmmo * 0.3), player.maxAmmo);
        this.game.updateAmmoUI();
      }
    }
    if (mods.killBuffDuration) {
      this._applyBuff(shooterId, {
        damageMultiplier: mods.killBuffDamageMult || 1,
        moveSpeed: mods.killBuffSpeedMult || 1,
      }, mods.killBuffDuration);
    }
  }

  onDamageDealt(shooterId, targetId, damage, weapon) {
    const mods = this.getModifiers(shooterId);
    if (mods.lifeSteal) {
      const player = this.game.players.get(shooterId);
      if (player && player.alive) {
        const heal = damage * mods.lifeSteal;
        player.health = Math.min(player.health + heal, player.maxHealth);
        if (shooterId === this.game.network.myId) {
          this.game.updateHealthUI();
        }
      }
    }
  }

  onRespawn(playerId) {
    const mods = this.getModifiers(playerId);
    const player = this.game.players.get(playerId);
    if (!player) return;
    this.applyToPlayer(playerId);
    if (mods.postRespawnDuration) {
      player.postRespawnTimer = mods.postRespawnDuration;
      player.damageReduction = mods.postRespawnDmgReduction || 0.5;
    }
    if (mods.respawnRegenMult) {
      player.respawnRegenMult = mods.respawnRegenMult;
    }
  }

  updatePostRespawn(playerId, dt) {
    const player = this.game.players.get(playerId);
    if (!player || !player.postRespawnTimer) return;
    player.postRespawnTimer -= dt;
    if (player.postRespawnTimer <= 0) {
      player.postRespawnTimer = 0;
      player.damageReduction = 1;
      this.invalidate(playerId);
    }
  }

  updateRegen(playerId, dt) {
    const mods = this.getModifiers(playerId);
    if (!mods.healthRegen) return;
    const player = this.game.players.get(playerId);
    if (!player || !player.alive) return;
    const timer = this.regenTimers.get(playerId) || 0;
    const inCombat = player.lastDamageTime && (Date.now() - player.lastDamageTime < 3000);
    if (inCombat) {
      this.regenTimers.set(playerId, 0);
      return;
    }
    const newTimer = timer + dt;
    const rate = mods.healthRegen * (mods.respawnRegenMult && player.respawnRegenMult ? player.respawnRegenMult : 1);
    const interval = 1 / rate;
    if (newTimer >= interval) {
      this.regenTimers.set(playerId, newTimer - interval);
      if (player.health < player.maxHealth) {
        player.health = Math.min(player.health + 1, player.maxHealth);
        if (playerId === this.game.network.myId) {
          this.game.updateHealthUI();
        }
      }
    } else {
      this.regenTimers.set(playerId, newTimer);
    }
  }

  updateBuffs(playerId, dt) {
    const buff = this.activeBuffs.get(playerId);
    if (!buff) return;
    buff._remaining = (buff._remaining || 0) - dt;
    if (buff._remaining <= 0) {
      this.activeBuffs.delete(playerId);
      this.invalidate(playerId);
    }
  }

  updateOvercharge(playerId, dt) {
    const mods = this.getModifiers(playerId);
    if (!mods.overchargeInterval) return;
    if (!this._ocTimers) this._ocTimers = new Map();
    const timer = this._ocTimers.get(playerId) || 0;
    const newTimer = timer + dt;
    if (newTimer >= mods.overchargeInterval) {
      this._ocTimers.set(playerId, newTimer - mods.overchargeInterval);
      this._applyBuff(playerId, {
        beamDamageMultiplier: mods.overchargeDamageMult || 1.5,
      }, mods.overchargeDuration || 3);
    } else {
      this._ocTimers.set(playerId, newTimer);
    }
  }

  _applyBuff(playerId, mods, duration) {
    this.activeBuffs.set(playerId, { ...mods, _remaining: duration });
    this.invalidate(playerId);
  }

  getDamageMultiplier(shooterId) {
    const mods = this.getModifiers(shooterId);
    return mods.damageMultiplier || 1;
  }

  isCritical(shooterId) {
    const mods = this.getModifiers(shooterId);
    if (!mods.criticalChance) return false;
    return Math.random() < mods.criticalChance;
  }

  getCriticalDamageMultiplier(shooterId) {
    const mods = this.getModifiers(shooterId);
    return mods.criticalDamageMultiplier || 2;
  }

  updateAll(dt) {
    this.players = this.players || this.game.players;
    const allIds = [];
    this.game.players.forEach((p, id) => allIds.push(id));
    for (const id of allIds) {
      this.updateRegen(id, dt);
      this.updateBuffs(id, dt);
      this.updateOvercharge(id, dt);
      this.updatePostRespawn(id, dt);
    }
  }

  resetAll() {
    this.playerPassives.clear();
    this.playerModifiers.clear();
    this.activeBuffs.clear();
    this.regenTimers.clear();
    if (this._ocTimers) this._ocTimers.clear();
  }
}
