class WeaponRegistry {
  constructor() {
    this._list = [];
    this._map = {};
    this._defineAll();
  }

  _add(id, def) {
    def.id = id;
    def.pellets = def.pellets || 1;
    def.explosive = def.explosive || false;
    def.auto = def.auto || false;
    def.fireMode = def.fireMode || (def.auto ? 'auto' : 'semi');
    def.projSpeed = def.projSpeed || 50;
    def.projLifetime = def.projLifetime || 1.5;
    def.projRadius = def.projRadius || 0.2;
    def.spread = def.spread || 0;
    def.hitRadius = def.hitRadius || 0.8;
    def.explosiveRadius = def.explosiveRadius || 0;
    this._list.push(id);
    this._map[id] = def;
  }

  _defineAll() {
    this._add('pistol', {
      name: 'Pistol', category: 'pistol',
      damage: 20, fireRate: 0.25,
      maxAmmo: 10, reloadTime: 3,
      color: 0xffee00,
      fireRateStars: 2, rangeStars: 2, mobilityStars: 4,
    });
    this._add('smg', {
      name: 'SMG', category: 'smg',
      damage: 12, fireRate: 0.06,
      projSpeed: 48, projRadius: 0.10, spread: 0.10,
      maxAmmo: 35, reloadTime: 2.2,
      color: 0x00ffaa,
      auto: true,
      fireRateStars: 5, rangeStars: 1, mobilityStars: 3,
    });
    this._add('assault', {
      name: 'Assault Rifle', category: 'rifle',
      damage: 15, fireRate: 0.08,
      projSpeed: 55, projRadius: 0.15, spread: 0.06,
      maxAmmo: 30, reloadTime: 3,
      color: 0xff6600,
      auto: true,
      fireRateStars: 4, rangeStars: 2, mobilityStars: 3,
    });
    this._add('battlerifle', {
      name: 'Battle Rifle', category: 'rifle',
      damage: 28, fireRate: 0.18,
      projSpeed: 65, projRadius: 0.18, spread: 0.02,
      maxAmmo: 20, reloadTime: 3,
      color: 0xffaa00,
      fireRateStars: 2, rangeStars: 3, mobilityStars: 3,
    });
    this._add('shotgun', {
      name: 'Shotgun', category: 'shotgun',
      damage: 5, fireRate: 0.6,
      projSpeed: 50, projLifetime: 0.8, projRadius: 0.12,
      spread: 0.18, hitRadius: 0.3,
      maxAmmo: 8, reloadTime: 2,
      pellets: 6,
      color: 0xff6600,
      fireRateStars: 1, rangeStars: 1, mobilityStars: 2,
    });
    this._add('dmr', {
      name: 'DMR', category: 'rifle',
      damage: 35, fireRate: 0.35,
      projSpeed: 75, projRadius: 0.18, spread: 0,
      maxAmmo: 15, reloadTime: 3,
      color: 0x44ffaa,
      fireRateStars: 2, rangeStars: 4, mobilityStars: 3,
    });
    this._add('sniper', {
      name: 'Sniper Rifle', category: 'sniper',
      damage: 60, fireRate: 1.0,
      projSpeed: 90, projLifetime: 2.0, projRadius: 0.3,
      spread: 0, hitRadius: 0.9,
      maxAmmo: 5, reloadTime: 3,
      color: 0x00ffff,
      fireRateStars: 1, rangeStars: 5, mobilityStars: 1,
    });
    this._add('lmg', {
      name: 'LMG', category: 'heavy',
      damage: 14, fireRate: 0.07,
      projSpeed: 50, projRadius: 0.14, spread: 0.12,
      maxAmmo: 80, reloadTime: 5,
      color: 0xff4444,
      auto: true,
      fireRateStars: 4, rangeStars: 2, mobilityStars: 1,
    });
    this._add('rpg', {
      name: 'Rocket Launcher', category: 'heavy',
      damage: 70, fireRate: 1.2,
      projSpeed: 18, projLifetime: 3.0, projRadius: 0.4,
      spread: 0, hitRadius: 2.5,
      explosive: true, explosiveRadius: 2.5,
      maxAmmo: 1, reloadTime: 3.5,
      color: 0xff2200,
      fireRateStars: 1, rangeStars: 4, mobilityStars: 1,
    });
    this._add('grenade_launcher', {
      name: 'Grenade Launcher', category: 'heavy',
      damage: 80, fireRate: 0.9,
      projSpeed: 22, projLifetime: 2.5, projRadius: 0.35,
      spread: 0.04, hitRadius: 3.0,
      explosive: true, explosiveRadius: 3.0,
      maxAmmo: 4, reloadTime: 3,
      color: 0xff8800,
      fireRateStars: 1, rangeStars: 3, mobilityStars: 1,
    });
  }

  getAll() { return this._list.slice(); }
  get(id) { return this._map[id] || null; }
  getIndex(id) { return this._list.indexOf(id); }
  at(index) {
    if (index < 0) index = this._list.length - 1;
    else if (index >= this._list.length) index = 0;
    return this._list[index];
  }
  next(id) {
    const idx = this.getIndex(id);
    if (idx === -1) return this._list[0];
    return this.at(idx + 1);
  }
  prev(id) {
    const idx = this.getIndex(id);
    if (idx === -1) return this._list[this._list.length - 1];
    return this.at(idx - 1);
  }
  count() { return this._list.length; }
  statsLines(id) {
    const w = this.get(id);
    if (!w) return [];
    return [
      `Damage  : ${w.damage}`,
      `Ammo    : ${w.maxAmmo}`,
      `Fire Rate : ${'★'.repeat(w.fireRateStars)}${'☆'.repeat(5 - w.fireRateStars)}`,
      `Range   : ${'★'.repeat(w.rangeStars)}${'☆'.repeat(5 - w.rangeStars)}`,
      `Mobility : ${'★'.repeat(w.mobilityStars)}${'☆'.repeat(5 - w.mobilityStars)}`,
    ];
  }
}

const WEAPON_REGISTRY = new WeaponRegistry();

/* 旧コード互換: WEAPONS[weaponId] でアクセス可能 */
const WEAPONS = {};
WEAPON_REGISTRY.getAll().forEach(id => {
  WEAPONS[id] = WEAPON_REGISTRY.get(id);
});
