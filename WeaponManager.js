class WeaponManager {
  constructor(registry) {
    this.registry = registry || WEAPON_REGISTRY;
    this._current = this.registry.getAll()[0] || 'pistol';
    this._prevWeapon = this._current;
  }

  get current() { return this._current; }
  get currentDef() { return this.registry.get(this._current); }
  get currentId() { return this._current; }

  next() {
    this._prevWeapon = this._current;
    this._current = this.registry.next(this._current);
    return this._current;
  }

  prev() {
    this._prevWeapon = this._current;
    this._current = this.registry.prev(this._current);
    return this._current;
  }

  set(id) {
    if (this.registry.get(id)) {
      this._prevWeapon = this._current;
      this._current = id;
      return true;
    }
    return false;
  }

  rollback() {
    this._current = this._prevWeapon;
  }

  getWeapon(id) {
    return this.registry.get(id);
  }

  getAll() {
    return this.registry.getAll();
  }

  count() {
    return this.registry.count();
  }

  isBeamWeapon(id) {
    const w = this.registry.get(id || this._current);
    return w && w.weaponType === 'beam';
  }
}
