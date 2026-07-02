class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.effects = [];
  }

  spawnExplosionParticles(pos, color, count) {
    const particles = [];
    for (let i = 0; i < (count || 30); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 15;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.random() * 10 + 2,
        Math.sin(angle) * speed
      );
      const life = 0.5 + Math.random() * 0.8;
      this._addParticle(color || 0xff4400, pos, vel, life, 0.3 + Math.random() * 0.5);
    }
    return particles;
  }

  spawnSparks(pos, color, count) {
    for (let i = 0; i < (count || 15); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 10;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.random() * 6 - 3,
        Math.sin(angle) * speed
      );
      this._addSpark(color || 0xffff00, pos, vel, 0.2 + Math.random() * 0.3);
    }
  }

  spawnSmoke(pos, color, count) {
    for (let i = 0; i < (count || 10); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 4,
        Math.sin(angle) * speed
      );
      this._addSmokeParticle(color || 0x444444, pos, vel, 0.8 + Math.random() * 0.6);
    }
  }

  spawnDebris(pos, count) {
    for (let i = 0; i < (count || 8); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        3 + Math.random() * 8,
        Math.sin(angle) * speed
      );
      this._addDebris(pos, vel, 0.5 + Math.random() * 0.5);
    }
  }

  spawnRingParticles(pos, color, count, radius) {
    for (let i = 0; i < (count || 20); i++) {
      const angle = (i / (count || 20)) * Math.PI * 2;
      const r = radius || 2;
      const target = new THREE.Vector3(
        pos.x + Math.cos(angle) * r,
        pos.y,
        pos.z + Math.sin(angle) * r
      );
      const vel = target.sub(pos).normalize().multiplyScalar(5 + Math.random() * 5);
      this._addParticle(color || 0xffffff, pos, vel, 0.4, 0.2);
    }
  }

  spawnNeonBurst(pos, color, count) {
    for (let i = 0; i < (count || 40); i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 8 + Math.random() * 15;
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );
      this._addParticle(color || 0x00f0ff, pos, vel, 0.6 + Math.random() * 0.6, 0.15 + Math.random() * 0.2);
    }
  }

  spawnSpeedLines(pos, dir, count) {
    for (let i = 0; i < (count || 20); i++) {
      const spread = 2;
      const vel = new THREE.Vector3(
        dir.x * 20 + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        dir.z * 20 + (Math.random() - 0.5) * spread
      );
      const p = new THREE.Vector3(
        pos.x + (Math.random() - 0.5) * 3,
        0.2 + Math.random() * 0.5,
        pos.z + (Math.random() - 0.5) * 3
      );
      this._addSpeedLine(0x00f0ff, p, vel, 0.15);
    }
  }

  spawnRespawnParticles(pos, color, count) {
    for (let i = 0; i < (count || 50); i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 4;
      const vel = new THREE.Vector3(
        Math.cos(theta) * r,
        Math.random() * 8 + 4,
        Math.sin(theta) * r
      );
      this._addParticle(color || 0x00f0ff, pos, vel, 0.8 + Math.random() * 0.8, 0.2 + Math.random() * 0.3);
    }
  }

  spawnJumpPadParticles(pos, color) {
    for (let i = 0; i < 10; i++) {
      const theta = (i / 10) * Math.PI * 2;
      const vel = new THREE.Vector3(
        Math.cos(theta) * 3,
        2 + Math.random() * 3,
        Math.sin(theta) * 3
      );
      this._addParticle(color || 0x00f0ff, pos, vel, 0.6, 0.15);
    }
  }

  _addParticle(color, pos, vel, life, size) {
    const geo = new THREE.SphereGeometry(size || 0.1, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.effects.push({
      type: 'particle', mesh, mat, geo,
      vel: vel.clone(),
      life: 0, maxLife: life || 0.5,
      gravity: true,
    });
    return mesh;
  }

  _addSpark(color, pos, vel, life) {
    const geo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.effects.push({
      type: 'spark', mesh, mat, geo,
      vel: vel.clone(),
      life: 0, maxLife: life || 0.3,
      gravity: true,
    });
    return mesh;
  }

  _addSmokeParticle(color, pos, vel, life) {
    const size = 0.3 + Math.random() * 0.4;
    const geo = new THREE.SphereGeometry(size, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: color || 0x444444,
      transparent: true, opacity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.effects.push({
      type: 'smoke', mesh, mat, geo,
      vel: vel.clone(),
      life: 0, maxLife: life || 1.0,
      gravity: false,
      growSpeed: 0.5 + Math.random() * 0.5,
    });
    return mesh;
  }

  _addDebris(pos, vel, life) {
    const sizes = [0.06, 0.08, 0.1, 0.12];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const geo = new THREE.BoxGeometry(size, size * (0.5 + Math.random() * 0.5), size);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true, opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    const rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    this.scene.add(mesh);
    this.effects.push({
      type: 'debris', mesh, mat, geo,
      vel: vel.clone(),
      rotSpeed,
      life: 0, maxLife: life || 0.5,
      gravity: true,
    });
    return mesh;
  }

  _addSpeedLine(color, pos, vel, life) {
    const geo = new THREE.BoxGeometry(0.02, 0.02, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(vel.clone().normalize()));
    this.scene.add(mesh);
    this.effects.push({
      type: 'speedline', mesh, mat, geo,
      vel: vel.clone(),
      life: 0, maxLife: life || 0.15,
      gravity: false,
    });
    return mesh;
  }

  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life += dt;
      if (e.life >= e.maxLife) {
        this.scene.remove(e.mesh);
        e.geo.dispose();
        e.mat.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      const t = e.life / e.maxLife;
      e.mesh.position.x += e.vel.x * dt;
      e.mesh.position.y += (e.vel.y + (e.gravity ? -9.8 * e.life : 0)) * dt;
      e.mesh.position.z += e.vel.z * dt;
      e.mat.opacity = 1 - t;
      if (e.type === 'smoke') {
        const s = 1 + t * (e.growSpeed || 1);
        e.mesh.scale.setScalar(s);
      }
      if (e.type === 'debris') {
        e.mesh.rotation.x += (e.rotSpeed ? e.rotSpeed.x : 0) * dt;
        e.mesh.rotation.y += (e.rotSpeed ? e.rotSpeed.y : 0) * dt;
        e.mesh.rotation.z += (e.rotSpeed ? e.rotSpeed.z : 0) * dt;
      }
      if (e.type === 'speedline') {
        e.mesh.scale.setScalar(1 - t * 0.8);
      }
    }
  }

  clear() {
    this.effects.forEach(e => {
      this.scene.remove(e.mesh);
      e.geo.dispose();
      e.mat.dispose();
    });
    this.effects = [];
  }

  get count() { return this.effects.length; }
}
