/**
 * Clase Vector3D para cálculo vectorial en 3 dimensiones.
 * Diseñada para máxima estabilidad numérica y eficiencia en simulaciones científicas.
 */
export class Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static readonly ZERO = new Vector3D(0, 0, 0);
  static readonly UNIT_X = new Vector3D(1, 0, 0);
  static readonly UNIT_Y = new Vector3D(0, 1, 0);
  static readonly UNIT_Z = new Vector3D(0, 0, 1);

  add(v: Vector3D): Vector3D {
    return new Vector3D(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vector3D): Vector3D {
    return new Vector3D(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): Vector3D {
    return new Vector3D(this.x * s, this.y * s, this.z * s);
  }

  dot(v: Vector3D): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vector3D): Vector3D {
    return new Vector3D(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  normSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  norm(): number {
    return Math.sqrt(this.normSquared());
  }

  normalize(): Vector3D {
    const len = this.norm();
    if (len === 0 || !isFinite(len)) {
      return Vector3D.ZERO;
    }
    return new Vector3D(this.x / len, this.y / len, this.z / len);
  }

  distanceTo(v: Vector3D): number {
    return this.sub(v).norm();
  }

  distanceSquared(v: Vector3D): number {
    return this.sub(v).normSquared();
  }

  lerp(target: Vector3D, alpha: number): Vector3D {
    return new Vector3D(
      this.x + (target.x - this.x) * alpha,
      this.y + (target.y - this.y) * alpha,
      this.z + (target.z - this.z) * alpha
    );
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  static fromArray(arr: [number, number, number] | number[]): Vector3D {
    return new Vector3D(arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0);
  }

  equals(v: Vector3D, tolerance = 1e-9): boolean {
    return (
      Math.abs(this.x - v.x) <= tolerance &&
      Math.abs(this.y - v.y) <= tolerance &&
      Math.abs(this.z - v.z) <= tolerance
    );
  }
}
