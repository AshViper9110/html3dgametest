class NetworkValidator {
  static sanitize(v, fallback) {
    if (v === undefined || v === null) return fallback !== undefined ? fallback : 0;
    if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))) return fallback !== undefined ? fallback : 0;
    return v;
  }

  static sanitizeVec3(obj) {
    if (!obj || typeof obj !== 'object') return { x: 0, y: 0, z: 0 };
    return {
      x: NetworkValidator.sanitize(obj.x, 0),
      y: NetworkValidator.sanitize(obj.y, 0),
      z: NetworkValidator.sanitize(obj.z, 0),
    };
  }

  static sanitizeQuat(obj) {
    if (!obj || typeof obj !== 'object') return { x: 0, y: 0, z: 0, w: 1 };
    return {
      x: NetworkValidator.sanitize(obj.x, 0),
      y: NetworkValidator.sanitize(obj.y, 0),
      z: NetworkValidator.sanitize(obj.z, 0),
      w: NetworkValidator.sanitize(obj.w, 1),
    };
  }

  static isString(v) { return typeof v === 'string'; }
  static isNumber(v) { return typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v); }
  static isPositiveNumber(v) { return NetworkValidator.isNumber(v) && v >= 0; }
  static isInRange(v, min, max) { return NetworkValidator.isNumber(v) && v >= min && v <= max; }

  static quantizeFloat(v, decimals) {
    const mult = Math.pow(10, decimals || 1);
    return Math.round(v * mult) / mult;
  }

  static quantizeVec3(v, decimals) {
    return {
      x: NetworkValidator.quantizeFloat(v.x, decimals),
      y: NetworkValidator.quantizeFloat(v.y, decimals),
      z: NetworkValidator.quantizeFloat(v.z, decimals),
    };
  }

  static quantizeQuat(q, decimals) {
    return {
      x: NetworkValidator.quantizeFloat(q.x, decimals),
      y: NetworkValidator.quantizeFloat(q.y, decimals),
      z: NetworkValidator.quantizeFloat(q.z, decimals),
      w: NetworkValidator.quantizeFloat(q.w, decimals),
    };
  }

  static wrap(data, senderId) {
    if (!data) return null;
    const seq = (NetworkValidator._seq || 0) + 1;
    NetworkValidator._seq = seq;
    return {
      ...data,
      _seq: seq,
      _sender: senderId,
      _time: Date.now(),
    };
  }

  static unwrap(data) {
    if (!data || typeof data !== 'object') return null;
    return {
      seq: NetworkValidator.sanitize(data._seq, 0),
      sender: NetworkValidator.sanitize(data._sender, ''),
      time: NetworkValidator.sanitize(data._time, 0),
    };
  }
}

NetworkValidator._seq = 0;
