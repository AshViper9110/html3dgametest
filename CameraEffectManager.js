class CameraEffectManager {
  constructor(camera) {
    this.camera = camera;
    this.baseFov = 65;
    this.shakeIntensity = 0;
    this.shakeDecay = 8;
    this.fovOffset = 0;
    this.fovDuration = 0;
    this.fovTarget = 0;
    this.redFlash = 0;
    this.whiteFlash = 0;
    this.slowMo = 0;
    this.slowMoDuration = 0;
    this.originalDt = 0;
    this._posX = 0;
    this._posZ = 0;
  }

  hitShake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity || 3);
  }

  explosionShake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity || 8);
  }

  dashFov() {
    this.fovOffset = 10;
    this.fovDuration = 0.15;
  }

  damageFlash() {
    this.redFlash = 0.4;
  }

  killFlash() {
    this.whiteFlash = 0.6;
    this.shakeIntensity = Math.max(this.shakeIntensity, 6);
  }

  headshotEffect() {
    this.whiteFlash = 0.3;
    this.shakeIntensity = Math.max(this.shakeIntensity, 10);
    this.fovOffset = 5;
    this.fovDuration = 0.1;
  }

  criticalEffect() {
    this.whiteFlash = 0.2;
    this.shakeIntensity = Math.max(this.shakeIntensity, 5);
  }

  roundStartEffect() {
    this.fovOffset = -5;
    this.fovDuration = 0.3;
  }

  victoryEffect() {
    this.fovOffset = -8;
    this.fovDuration = 0.5;
  }

  defeatEffect() {
    this.redFlash = 0.8;
    this.fovOffset = 3;
    this.fovDuration = 0.4;
  }

  killSlowMo() {
    this.slowMo = 1;
    this.slowMoDuration = 0.08;
    this.originalDt = 0;
  }

  update(dt) {
    this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
    if (this.shakeIntensity > 0.1) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.1;
      this.camera.position.z += (Math.random() - 0.5) * this.shakeIntensity * 0.1;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.05;
    }

    if (this.fovDuration > 0) {
      this.fovDuration -= dt;
      const t = Math.max(0, this.fovDuration / (this.fovDuration + dt || 1));
      this.camera.fov = this.baseFov + this.fovOffset * t;
      this.camera.updateProjectionMatrix();
      if (this.fovDuration <= 0) {
        this.fovOffset = 0;
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
      }
    }

    if (this.redFlash > 0) {
      this.redFlash = Math.max(0, this.redFlash - dt * 2);
    }

    if (this.whiteFlash > 0) {
      this.whiteFlash = Math.max(0, this.whiteFlash - dt * 3);
    }

    return dt;
  }

  getRedFlash() {
    return this.redFlash;
  }

  getWhiteFlash() {
    return this.whiteFlash;
  }

  reset() {
    this.shakeIntensity = 0;
    this.fovOffset = 0;
    this.fovDuration = 0;
    this.redFlash = 0;
    this.whiteFlash = 0;
    this.slowMo = 0;
    this.slowMoDuration = 0;
    this.camera.fov = this.baseFov;
  }
}
