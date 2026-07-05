class ParticlePool {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(
      () => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(SHARED.geo('particle_main', () => new THREE.SphereGeometry(0.08, 4, 4)), mat);
        return { mesh, mat, life: 0, maxLife: 0, velocity: new THREE.Vector3() };
      },
      (p) => {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.mesh.visible = false;
        p.velocity.set(0, 0, 0);
        p.life = 0;
        p.maxLife = 0;
      },
      500
    );
    this.poolSpark = new ObjectPool(
      () => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(SHARED.geo('particle_spark', () => new THREE.BoxGeometry(0.05, 0.05, 0.15)), mat);
        return { mesh, mat, life: 0, maxLife: 0, velocity: new THREE.Vector3() };
      },
      (p) => {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.mesh.visible = false;
        p.velocity.set(0, 0, 0);
        p.life = 0;
        p.maxLife = 0;
      },
      200
    );
  }

  get(color, pos, vel, life, size) {
    const p = this.pool.get();
    p.mat.color.setHex(color);
    p.mat.opacity = 1;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(size || 1);
    p.velocity.copy(vel);
    p.life = 0;
    p.maxLife = life || 0.5;
    p.alive = true;
    if (!p.mesh.parent) this.scene.add(p.mesh);
    p.mesh.visible = true;
    return p;
  }

  getSpark(color, pos, vel, life) {
    const p = this.poolSpark.get();
    p.mat.color.setHex(color);
    p.mat.opacity = 1;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(1);
    p.velocity.copy(vel);
    p.life = 0;
    p.maxLife = life || 0.3;
    p.alive = true;
    if (!p.mesh.parent) this.scene.add(p.mesh);
    p.mesh.visible = true;
    return p;
  }

  release(p) {
    this.pool.release(p);
  }

  releaseSpark(p) {
    this.poolSpark.release(p);
  }

  update(dt) {
    const updateList = (items, pool) => {
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          pool.release(p);
          continue;
        }
        const t = p.life / p.maxLife;
        p.mesh.position.x += p.velocity.x * dt;
        p.mesh.position.y += p.velocity.y * dt;
        p.mesh.position.z += p.velocity.z * dt;
        p.velocity.y -= 5 * dt;
        p.mat.opacity = 1 - t;
        p.mesh.scale.setScalar(1 - t * 0.5);
      }
    };
    updateList(this.pool.active, this.pool);
    updateList(this.poolSpark.active, this.poolSpark);
  }

  releaseAll() {
    this.pool.releaseAll();
    this.poolSpark.releaseAll();
  }

  get activeCount() { return this.pool.activeCount + this.poolSpark.activeCount; }
}
