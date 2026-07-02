class LightPool {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.maxSize = 50;
  }

  _createLight() {
    const light = new THREE.PointLight(0xffffff, 1, 10);
    return { light, life: 0, maxLife: 0 };
  }

  get(color, pos, intensity, distance, life) {
    let entry;
    if (this.pool.length > 0) {
      entry = this.pool.pop();
    } else {
      entry = this._createLight();
    }
    entry.light.color.setHex(color);
    entry.light.intensity = intensity || 2;
    entry.light.distance = distance || 15;
    entry.light.position.copy(pos);
    entry.life = 0;
    entry.maxLife = life || 0.3;
    if (!entry.light.parent) this.scene.add(entry.light);
    entry.light.visible = true;
    this.active.push(entry);
    return entry;
  }

  release(entry) {
    const idx = this.active.indexOf(entry);
    if (idx >= 0) this.active.splice(idx, 1);
    entry.light.visible = false;
    if (entry.light.parent) entry.light.parent.remove(entry.light);
    if (this.pool.length < this.maxSize) {
      this.pool.push(entry);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.life += dt;
      if (e.life >= e.maxLife) {
        this.release(e);
        continue;
      }
      const t = e.life / e.maxLife;
      e.light.intensity *= (1 - dt / e.maxLife);
    }
  }

  releaseAll() {
    [...this.active].forEach(e => this.release(e));
  }

  get activeCount() { return this.active.length; }
}
