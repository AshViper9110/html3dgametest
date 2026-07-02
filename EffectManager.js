class EffectManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.particleManager = new ParticleManager(scene);
    this.lightPool = new LightPool(scene);
    this.activeEffects = [];
    this.ringGeo = new THREE.RingGeometry(0.1, 0.3, 16);
    this.shockwaveRingGeo = new THREE.RingGeometry(0.5, 1.0, 24);
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
  }

  spawnMuzzleFlash(pos, dir, color) {
    const c = color || 0xffee00;
    const p = pos.clone();
    p.y += CONFIG.playerHeight * 0.6;

    const flashGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(p);
    flash.position.add(dir.clone().multiplyScalar(0.8));
    this.scene.add(flash);
    this.activeEffects.push({
      type: 'muzzle_flash', mesh: flash, mat: flashMat, geo: flashGeo,
      life: 0, maxLife: 0.08,
    });

    const glowMat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), glowMat);
    glow.position.copy(flash.position);
    this.scene.add(glow);
    this.activeEffects.push({
      type: 'muzzle_glow', mesh: glow, mat: glowMat, geo: glow.geometry,
      life: 0, maxLife: 0.12,
    });

    const beamMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.3,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 1.5, 4), beamMat);
    beam.position.copy(p);
    beam.position.add(dir.clone().multiplyScalar(0.75));
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    beam.quaternion.copy(q);
    this.scene.add(beam);
    this.activeEffects.push({
      type: 'muzzle_beam', mesh: beam, mat: beamMat, geo: beam.geometry,
      life: 0, maxLife: 0.1,
    });

    this.lightPool.get(c, p, 3, 8, 0.15);

    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      const v = new THREE.Vector3(
        dir.x * spd + Math.cos(a) * 2,
        (Math.random() - 0.5) * 3,
        dir.z * spd + Math.sin(a) * 2
      );
      this.particleManager._addSpark(c, p, v, 0.15 + Math.random() * 0.1);
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 12), ringMat);
    ring.position.copy(p);
    ring.lookAt(p.clone().add(dir));
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'muzzle_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.12,
    });
  }

  spawnHitEffect(pos, color) {
    const c = color || 0xffffff;

    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 8;
      const v = new THREE.Vector3(
        Math.cos(a) * spd,
        (Math.random() - 0.5) * 6,
        Math.sin(a) * spd
      );
      this.particleManager._addSpark(c, pos, v, 0.2 + Math.random() * 0.2);
    }

    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      const v = new THREE.Vector3(
        Math.cos(a) * spd,
        1 + Math.random() * 3,
        Math.sin(a) * spd
      );
      this.particleManager._addSmokeParticle(0x888888, pos, v, 0.4 + Math.random() * 0.3);
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.4, 16), ringMat);
    ring.position.copy(pos);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'hit_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.2,
    });

    this.lightPool.get(c, pos, 2, 6, 0.15);

    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), flashMat);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.activeEffects.push({
      type: 'hit_flash', mesh: flash, mat: flashMat, geo: flash.geometry,
      life: 0, maxLife: 0.06,
    });
  }

  spawnExplosion(pos, color) {
    const c = color || 0xff4400;
    const p = pos.clone();

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 1,
    });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), flashMat);
    flash.position.copy(p);
    this.scene.add(flash);
    this.activeEffects.push({
      type: 'exp_flash', mesh: flash, mat: flashMat, geo: flash.geometry,
      life: 0, maxLife: 0.08, scaleSpeed: 8,
    });

    const boomMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.7,
    });
    const boom = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), boomMat);
    boom.position.copy(p);
    this.scene.add(boom);
    this.activeEffects.push({
      type: 'explosion_ball', mesh: boom, mat: boomMat, geo: boom.geometry,
      life: 0, maxLife: 0.4, scaleSpeed: 5,
    });

    const ringMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.8, 24), ringMat);
    ring.position.copy(p);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'exp_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.35, scaleSpeed: 6,
    });

    const ring2Mat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    });
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 24), ring2Mat);
    ring2.position.copy(p);
    this.scene.add(ring2);
    this.activeEffects.push({
      type: 'exp_ring2', mesh: ring2, mat: ring2Mat, geo: ring2.geometry,
      life: 0, maxLife: 0.5, scaleSpeed: 4,
    });

    this.particleManager.spawnExplosionParticles(p, c, 100);
    this.particleManager.spawnSparks(p, 0xffffaa, 20);
    this.particleManager.spawnSmoke(p, 0x333333, 15);
    this.particleManager.spawnDebris(p, 10);

    this.lightPool.get(0xff8800, p, 8, 20, 0.5);
    this.lightPool.get(c, p, 4, 12, 0.3);

    const afterglowMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.15,
    });
    const afterglow = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 12), afterglowMat);
    afterglow.position.copy(p);
    this.scene.add(afterglow);
    this.activeEffects.push({
      type: 'exp_afterglow', mesh: afterglow, mat: afterglowMat, geo: afterglow.geometry,
      life: 0, maxLife: 0.8, scaleSpeed: 2,
    });
  }

  spawnExplosionFX(pos, color) {
    this.spawnExplosion(pos, color);
  }

  spawnDashEffect(pos, dir) {
    const p = pos.clone();
    p.y += CONFIG.playerHeight * 0.3;

    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.5;
      const v = new THREE.Vector3(
        Math.cos(a) * r * 3,
        (Math.random() - 0.5) * 2,
        Math.sin(a) * r * 3
      );
      this.particleManager._addParticle(0x00f0ff, p, v, 0.2 + Math.random() * 0.2, 0.08);
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 16), ringMat);
    ring.position.copy(p);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'dash_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.25, scaleSpeed: 4,
    });

    this.particleManager.spawnSpeedLines(p, dir, 15);
  }

  spawnLandingEffect(pos) {
    const p = pos.clone();
    p.y = 0.05;

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.8, 16), ringMat);
    ring.position.copy(p);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'land_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.2, scaleSpeed: 5,
    });
  }

  spawnRespawnEffect(pos, color) {
    const c = color || 0x00f0ff;
    const p = pos.clone();
    p.y = 0.5;

    this.particleManager.spawnRespawnParticles(p, c, 50);

    const ringMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.8, 20), ringMat);
    ring.position.copy(p);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'respawn_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.4, scaleSpeed: 4,
    });

    const pillarMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.2,
    });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.0, 3, 8), pillarMat);
    pillar.position.copy(p);
    pillar.position.y += 1.5;
    this.scene.add(pillar);
    this.activeEffects.push({
      type: 'respawn_pillar', mesh: pillar, mat: pillarMat, geo: pillar.geometry,
      life: 0, maxLife: 0.6,
    });

    this.lightPool.get(c, p, 4, 10, 0.5);
  }

  spawnJumpPadEffect(pos, color) {
    const c = color || 0x00f0ff;
    const p = pos.clone();
    p.y = 0.1;

    this.particleManager.spawnJumpPadParticles(p, c);

    const ringMat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 12), ringMat);
    ring.position.copy(p);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'pad_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.3, scaleSpeed: 3,
    });

    this.lightPool.get(c, p, 2, 6, 0.3);
  }

  spawnKillEffect(pos) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0044, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.5, 24), ringMat);
    ring.position.set(pos.x, 0.5, pos.z);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({
      type: 'kill_ring', mesh: ring, mat: ringMat, geo: ring.geometry,
      life: 0, maxLife: 0.5, scaleSpeed: 6,
    });

    this.particleManager.spawnNeonBurst(
      new THREE.Vector3(pos.x, 0.5, pos.z),
      0xff0044, 30
    );

    this.lightPool.get(0xff0044, new THREE.Vector3(pos.x, 0.5, pos.z), 6, 15, 0.4);
  }

  spawnPlayerDamageFlash(player) {
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5,
    });
    const flash = player.mesh.clone();
    flash.material = flashMat;
    flash.scale.setScalar(1.05);
    flash.position.copy(player.mesh.position);
    flash.position.y = CONFIG.playerHeight / 2;
    this.scene.add(flash);
    this.activeEffects.push({
      type: 'dmg_flash', mesh: flash, mat: flashMat,
      life: 0, maxLife: 0.1,
      cleanup: () => { flash.geometry.dispose(); },
    });
  }

  spawnTrailSegment(pos, color, speed) {
    const trailLen = Math.min(1 + speed / 30, 3);
    const geo = new THREE.SphereGeometry(0.05 * trailLen, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    this.scene.add(m);
    this.activeEffects.push({
      type: 'trail', mesh: m, mat, geo,
      life: 0, maxLife: 0.3 + speed * 0.005,
    });
  }

  update(dt) {
    this.particleManager.update(dt);
    this.lightPool.update(dt);

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const e = this.activeEffects[i];
      e.life += dt;
      if (e.life >= e.maxLife) {
        this.scene.remove(e.mesh);
        if (e.geo) e.geo.dispose();
        if (e.mat) e.mat.dispose();
        if (e.cleanup) e.cleanup();
        this.activeEffects.splice(i, 1);
        continue;
      }
      const t = e.life / e.maxLife;
      e.mat.opacity = 1 - t;
      if (e.scaleSpeed) {
        const s = 1 + t * e.scaleSpeed;
        e.mesh.scale.setScalar(s);
      }
    }
  }

  getParticleCount() {
    return this.particleManager.count + this.activeEffects.length;
  }

  clear() {
    this.activeEffects.forEach(e => {
      this.scene.remove(e.mesh);
      if (e.geo) e.geo.dispose();
      if (e.mat) e.mat.dispose();
      if (e.cleanup) e.cleanup();
    });
    this.activeEffects = [];
    this.particleManager.clear();
    this.lightPool.releaseAll();
  }
}
