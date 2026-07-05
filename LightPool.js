class LightPool {
  constructor(scene) {
    this.scene = scene;
    this._defaultLife = 0.15;
    this.pool = new ObjectPool(
      () => {
        const light = new THREE.PointLight(0xffffff, 1, 10);
        return { light, life: 0, maxLife: 0 };
      },
      (e) => {
        if (e.light.parent) e.light.parent.remove(e.light);
        e.light.visible = false;
        e.life = 0;
        e.maxLife = 0;
      },
       30
    );
  }

  get(color, pos, intensity, distance, life) {
    const e = this.pool.get();
    e.light.color.setHex(color);
    e.light.intensity = intensity || 2;
    e.light.distance = distance || 15;
    e.light.position.copy(pos);
    e.life = 0;
    e.maxLife = life || this._defaultLife;
    if (!e.light.parent) this.scene.add(e.light);
    e.light.visible = true;
    return e;
  }

  release(entry) {
    this.pool.release(entry);
  }

  update(dt) {
    for (let i = this.pool.active.length - 1; i >= 0; i--) {
      const e = this.pool.active[i];
      e.life += dt;
      if (e.life >= e.maxLife) {
        this.release(e);
        continue;
      }
      e.light.intensity *= (1 - dt / e.maxLife);
    }
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  get activeCount() { return this.pool.activeCount; }
}
