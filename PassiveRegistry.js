const PASSIVES = Object.freeze({
  /* ==================================================
     Movement
     ================================================== */
  runner: {
    id: 'runner', displayName: 'Runner', description: '移動速度+10%',
    category: 'Movement', icon: '🏃', rarity: 'common',
    modifiers: { moveSpeed: 1.1 }, enabled: true,
  },
  sprinter: {
    id: 'sprinter', displayName: 'Sprinter', description: 'ダッシュ速度+15%',
    category: 'Movement', icon: '💨', rarity: 'common',
    modifiers: { dashSpeed: 1.15 }, enabled: true,
  },
  feather: {
    id: 'feather', displayName: 'Feather', description: 'ジャンプ+20%',
    category: 'Movement', icon: '🪶', rarity: 'common',
    modifiers: { jumpPower: 1.2 }, enabled: true,
  },
  parkour: {
    id: 'parkour', displayName: 'Parkour', description: '空中制御・壁走り向上',
    category: 'Movement', icon: '🧗', rarity: 'rare',
    modifiers: { airControl: 1.5 }, enabled: true,
  },
  marathon: {
    id: 'marathon', displayName: 'Marathon', description: 'スタミナ消費-30%',
    category: 'Movement', icon: '🏅', rarity: 'uncommon',
    modifiers: { staminaCost: 0.7 }, enabled: true,
  },

  /* ==================================================
     Survival
     ================================================== */
  survivor: {
    id: 'survivor', displayName: 'Survivor', description: 'HP+20',
    category: 'Survival', icon: '❤️', rarity: 'common',
    modifiers: { maxHealthFlat: 20 }, enabled: true,
  },
  regeneration: {
    id: 'regeneration', displayName: 'Regeneration', description: '非戦闘時HP回復',
    category: 'Survival', icon: '🔄', rarity: 'uncommon',
    modifiers: { healthRegen: 3 }, enabled: true,
  },
  ironSkin: {
    id: 'ironSkin', displayName: 'Iron Skin', description: '爆発ダメージ-20%',
    category: 'Survival', icon: '🛡️', rarity: 'uncommon',
    modifiers: { explosionDamageReduction: 0.8 }, enabled: true,
  },
  medic: {
    id: 'medic', displayName: 'Medic', description: 'リスポーン後HP回復速度上昇',
    category: 'Survival', icon: '💊', rarity: 'rare',
    modifiers: { respawnRegenMult: 2.0 }, enabled: true,
  },
  shieldGenerator: {
    id: 'shieldGenerator', displayName: 'Shield Generator', description: 'リスポーン後3秒ダメージ半減',
    category: 'Survival', icon: '🔰', rarity: 'rare',
    modifiers: { postRespawnDmgReduction: 0.5, postRespawnDuration: 3 }, enabled: true,
  },

  /* ==================================================
     Weapon
     ================================================== */
  heavyHands: {
    id: 'heavyHands', displayName: 'Heavy Hands', description: '武器ダメージ+10%',
    category: 'Weapon', icon: '💪', rarity: 'common',
    modifiers: { damageMultiplier: 1.1 }, enabled: true,
  },
  rapidFire: {
    id: 'rapidFire', displayName: 'Rapid Fire', description: '連射+10%',
    category: 'Weapon', icon: '⚡', rarity: 'common',
    modifiers: { fireRateMultiplier: 1.1 }, enabled: true,
  },
  quickReload: {
    id: 'quickReload', displayName: 'Quick Reload', description: 'リロード25%高速',
    category: 'Weapon', icon: '🔄', rarity: 'uncommon',
    modifiers: { reloadMultiplier: 0.75 }, enabled: true,
  },
  steadyAim: {
    id: 'steadyAim', displayName: 'Steady Aim', description: '反動25%軽減',
    category: 'Weapon', icon: '🎯', rarity: 'common',
    modifiers: { recoilMultiplier: 0.75 }, enabled: true,
  },
  sharpshooter: {
    id: 'sharpshooter', displayName: 'Sharpshooter', description: '集弾率向上',
    category: 'Weapon', icon: '🎯', rarity: 'uncommon',
    modifiers: { spreadMultiplier: 0.8 }, enabled: true,
  },

  /* ==================================================
     Ammo
     ================================================== */
  extraMagazine: {
    id: 'extraMagazine', displayName: 'Extra Magazine', description: '装弾数+30%',
    category: 'Ammo', icon: '📦', rarity: 'common',
    modifiers: { magazineMultiplier: 1.3 }, enabled: true,
  },
  scavenger: {
    id: 'scavenger', displayName: 'Scavenger', description: 'キル時弾薬回復',
    category: 'Ammo', icon: '♻️', rarity: 'uncommon',
    modifiers: { ammoRegenOnKill: 1 }, enabled: true,
  },
  efficient: {
    id: 'efficient', displayName: 'Efficient', description: '弾消費-10%',
    category: 'Ammo', icon: '💎', rarity: 'rare',
    modifiers: { ammoCostMultiplier: 0.9 }, enabled: true,
  },
  supplyPack: {
    id: 'supplyPack', displayName: 'Supply Pack', description: '予備弾薬増加',
    category: 'Ammo', icon: '🎒', rarity: 'common',
    modifiers: { ammoMultiplier: 1.3 }, enabled: true,
  },
  fastHands: {
    id: 'fastHands', displayName: 'Fast Hands', description: '武器切替速度+30%',
    category: 'Ammo', icon: '🤲', rarity: 'uncommon',
    modifiers: { switchSpeedMultiplier: 1.3 }, enabled: true,
  },

  /* ==================================================
     Projectile
     ================================================== */
  ricochetExpert: {
    id: 'ricochetExpert', displayName: 'Ricochet Expert', description: '跳弾+1',
    category: 'Projectile', icon: '🪀', rarity: 'rare',
    modifiers: { ricochetCount: 1 }, enabled: true,
  },
  piercingRounds: {
    id: 'piercingRounds', displayName: 'Piercing Rounds', description: '敵を1体貫通',
    category: 'Projectile', icon: '🔱', rarity: 'rare',
    modifiers: { pierceCount: 1 }, enabled: true,
  },
  highVelocity: {
    id: 'highVelocity', displayName: 'High Velocity', description: '弾速+25%',
    category: 'Projectile', icon: '💨', rarity: 'uncommon',
    modifiers: { projSpeedMultiplier: 1.25 }, enabled: true,
  },
  explosiveSpecialist: {
    id: 'explosiveSpecialist', displayName: 'Explosive Specialist', description: '爆発半径+20%',
    category: 'Projectile', icon: '💥', rarity: 'rare',
    modifiers: { explosionRadiusMultiplier: 1.2 }, enabled: true,
  },
  heavyProjectile: {
    id: 'heavyProjectile', displayName: 'Heavy Projectile', description: '弾サイズ増加',
    category: 'Projectile', icon: '🪨', rarity: 'uncommon',
    modifiers: { projSizeMultiplier: 1.3 }, enabled: true,
  },

  /* ==================================================
     Energy
     ================================================== */
  energyMaster: {
    id: 'energyMaster', displayName: 'Energy Master', description: 'Beam射程・威力向上',
    category: 'Energy', icon: '🔋', rarity: 'rare',
    modifiers: { beamRangeMultiplier: 1.2, beamDamageMultiplier: 1.15 }, enabled: true,
  },
  plasmaOverload: {
    id: 'plasmaOverload', displayName: 'Plasma Overload', description: 'プラズマ爆発範囲拡大',
    category: 'Energy', icon: '☄️', rarity: 'epic',
    modifiers: { plasmaBoomMultiplier: 1.3 }, enabled: true,
  },
  beamStabilizer: {
    id: 'beamStabilizer', displayName: 'Beam Stabilizer', description: 'Beam拡散減少',
    category: 'Energy', icon: '📡', rarity: 'uncommon',
    modifiers: { beamSpreadMultiplier: 0.7 }, enabled: true,
  },
  coolingSystem: {
    id: 'coolingSystem', displayName: 'Cooling System', description: 'Energy武器の発射間隔短縮',
    category: 'Energy', icon: '❄️', rarity: 'uncommon',
    modifiers: { beamCooldownMultiplier: 0.8 }, enabled: true,
  },
  overcharge: {
    id: 'overcharge', displayName: 'Overcharge', description: '一定時間毎にBeam強化',
    category: 'Energy', icon: '⚡', rarity: 'epic',
    modifiers: { overchargeInterval: 10, overchargeDuration: 3, overchargeDamageMult: 1.5 }, enabled: true,
  },

  /* ==================================================
     Tactical
     ================================================== */
  tracker: {
    id: 'tracker', displayName: 'Tracker', description: '命中した敵をマーキング',
    category: 'Tactical', icon: '📌', rarity: 'uncommon',
    modifiers: { markOnHit: true }, enabled: true,
  },
  ghost: {
    id: 'ghost', displayName: 'Ghost', description: '足音減少',
    category: 'Tactical', icon: '👻', rarity: 'uncommon',
    modifiers: { footstepVolume: 0.4 }, enabled: true,
  },
  silentReload: {
    id: 'silentReload', displayName: 'Silent Reload', description: 'リロード音減少',
    category: 'Tactical', icon: '🤫', rarity: 'common',
    modifiers: { reloadSoundMultiplier: 0.3 }, enabled: true,
  },
  recon: {
    id: 'recon', displayName: 'Recon', description: '敵発砲をミニマップ表示',
    category: 'Tactical', icon: '🔍', rarity: 'rare',
    modifiers: { showEnemyFire: true }, enabled: true,
  },
  sixthSense: {
    id: 'sixthSense', displayName: 'Sixth Sense', description: '近距離の敵を検知',
    category: 'Tactical', icon: '🧠', rarity: 'rare',
    modifiers: { enemyProximityDetect: 10 }, enabled: true,
  },

  /* ==================================================
     Advanced
     ================================================== */
  vampire: {
    id: 'vampire', displayName: 'Vampire', description: '与ダメージの5%回復',
    category: 'Advanced', icon: '🧛', rarity: 'epic',
    modifiers: { lifeSteal: 0.05 }, enabled: true,
  },
  luckyShot: {
    id: 'luckyShot', displayName: 'Lucky Shot', description: '5%クリティカル',
    category: 'Advanced', icon: '🍀', rarity: 'epic',
    modifiers: { criticalChance: 0.05, criticalDamageMultiplier: 2.0 }, enabled: true,
  },
  adrenaline: {
    id: 'adrenaline', displayName: 'Adrenaline', description: 'HP30%以下で能力上昇',
    category: 'Advanced', icon: '💉', rarity: 'epic',
    modifiers: { lowHealthThreshold: 0.3, lowHealthDamageMult: 1.2, lowHealthSpeedMult: 1.15 }, enabled: true,
  },
  berserker: {
    id: 'berserker', displayName: 'Berserker', description: 'キル後5秒強化',
    category: 'Advanced', icon: '😠', rarity: 'epic',
    modifiers: { killBuffDuration: 5, killBuffDamageMult: 1.25, killBuffSpeedMult: 1.2 }, enabled: true,
  },
  engineer: {
    id: 'engineer', displayName: 'Engineer', description: '設置物・爆発物ダメージ増加',
    category: 'Advanced', icon: '🔧', rarity: 'rare',
    modifiers: { explosiveDamageMultiplier: 1.25 }, enabled: true,
  },
});

const PASSIVE_IDS = Object.keys(PASSIVES);

class PassiveRegistry {
  static getAll() {
    return PASSIVE_IDS;
  }

  static get(id) {
    return PASSIVES[id] || null;
  }

  static has(id) {
    return id in PASSIVES;
  }

  static next(currentId) {
    const idx = PASSIVE_IDS.indexOf(currentId);
    return PASSIVE_IDS[(idx + 1) % PASSIVE_IDS.length];
  }

  static prev(currentId) {
    const idx = PASSIVE_IDS.indexOf(currentId);
    return PASSIVE_IDS[(idx - 1 + PASSIVE_IDS.length) % PASSIVE_IDS.length];
  }

  static getByCategory(category) {
    return PASSIVE_IDS.filter(id => PASSIVES[id].category === category);
  }

  static statsLines(id) {
    const p = PASSIVES[id];
    if (!p) return [];
    const lines = [];
    if (p.rarity) lines.push(`◈ ${p.rarity.toUpperCase()}`);
    if (p.description) lines.push(p.description);
    return lines;
  }
}
