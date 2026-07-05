class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(
      () => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(SHARED.geo('proj_pool_main', () => new THREE.SphereGeometry(0.3, 8, 8)), mat);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
        const glow = new THREE.Mesh(SHARED.geo('proj_pool_glow', () => new THREE.SphereGeometry(0.6, 8, 8)), glowMat);
        return { mesh, glow, mat, glowMat, trail: [], trailTimer: 0 };
      },
      (obj) => this._resetProjectile(obj),
      100
    );
  }

  _resetProjectile(obj) {
    if (obj.mesh.parent) obj.mesh.parent.remove(obj.mesh);
    if (obj.glow.parent) obj.glow.parent.remove(obj.glow);
    obj.trail.forEach(t => {
      if (t.parent) t.parent.remove(t);
      if (t.material) t.material.dispose();
    });
    obj.trail = [];
    obj.trailTimer = 0;
  }

  get() { return this.pool.get(); }
  release(obj) { this.pool.release(obj); }
  releaseAll() { this.pool.releaseAll(); }
  get activeCount() { return this.pool.activeCount; }
}
