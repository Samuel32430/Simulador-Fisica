import { Vector3D } from '../../math/vector3d';
import { RK4Integrator } from '../../math/rk4-integrator';
import { Charge3D } from './charge3d';
import { CoulombEngine } from './coulomb-engine';

export interface FieldLineConfig {
  /** Cantidad de líneas emitidas por cada unidad de carga (o por carga) */
  linesPerCharge: number;
  /** Radio de inicio de las líneas alrededor del centro de la carga [m] */
  seedRadius: number;
  /** Longitud de paso de integración ds [m] */
  stepSize: number;
  /** Máximo de pasos por línea para evitar bucles infinitos */
  maxSteps: number;
  /** Límite espacial máximo (bounding radius) [m] */
  maxBoundingRadius: number;
}

export const DEFAULT_FIELDLINE_CONFIG: FieldLineConfig = {
  linesPerCharge: 12,
  seedRadius: 0.15,
  stepSize: 0.05,
  maxSteps: 300,
  maxBoundingRadius: 10.0,
};

/**
 * Trazador numérico de líneas de campo eléctrico en 3D mediante Runge-Kutta 4to Orden.
 */
export class FieldLineTracer {
  private engine = new CoulombEngine();

  constructor(private config: FieldLineConfig = DEFAULT_FIELDLINE_CONFIG) {}

  /**
   * Genera todas las líneas de campo para una distribución de cargas.
   * Retorna una colección de poli-líneas (cada una es una lista ordenada de Vector3D).
   */
  traceAllFieldLines(charges: Charge3D[]): Vector3D[][] {
    const activeCharges = charges.filter((c) => Math.abs(c.q) > 1e-12);
    if (activeCharges.length === 0) return [];

    const fieldLines: Vector3D[][] = [];
    const hasPositiveCharges = activeCharges.some((c) => c.q > 0);

    for (const sourceCharge of activeCharges) {
      // Si hay cargas positivas, sembramos principalmente en las positivas.
      // Si solo hay cargas negativas, sembramos en las negativas con dirección invertida.
      const shouldSeed = hasPositiveCharges
        ? sourceCharge.q > 0
        : sourceCharge.q < 0;

      if (!shouldSeed) continue;

      const directionSign = sourceCharge.q > 0 ? 1 : -1;
      const seedPoints = this.generateSphereSeedPoints(
        sourceCharge.position,
        this.config.seedRadius,
        this.config.linesPerCharge
      );

      for (const seed of seedPoints) {
        const line = this.traceSingleLine(
          seed,
          directionSign,
          activeCharges,
          sourceCharge.id
        );
        if (line.length > 2) {
          fieldLines.push(line);
        }
      }
    }

    return fieldLines;
  }

  /**
   * Traza una sola línea de campo paso a paso usando RK4.
   */
  private traceSingleLine(
    startPoint: Vector3D,
    directionSign: number,
    charges: Charge3D[],
    sourceChargeId: string
  ): Vector3D[] {
    const points: Vector3D[] = [startPoint];
    let current = startPoint;
    const ds = this.config.stepSize * directionSign;

    const derivativeFn = (_t: number, pos: Vector3D): Vector3D => {
      const eField = this.engine.calculateElectricField(pos, charges);
      const norm = eField.norm();
      if (norm < 1e-12) return Vector3D.ZERO;
      return eField.scale(1 / norm); // Vector unitario de campo
    };

    for (let step = 0; step < this.config.maxSteps; step++) {
      // Integración RK4
      const nextPoint = RK4Integrator.step(derivativeFn, 0, current, ds);

      // 1. Condición de escape del espacio
      if (nextPoint.norm() > this.config.maxBoundingRadius) {
        points.push(nextPoint);
        break;
      }

      // 2. Condición de absorción o choque con otra carga
      let hitOtherCharge = false;
      for (const ch of charges) {
        if (ch.id === sourceChargeId && step < 5) continue; // Evitar colisión temprana con la propia fuente
        const dist = nextPoint.distanceTo(ch.position);
        if (dist <= this.config.seedRadius) {
          points.push(ch.position); // Cerrar línea en el núcleo de la carga opuesta
          hitOtherCharge = true;
          break;
        }
      }

      if (hitOtherCharge) break;

      points.push(nextPoint);
      current = nextPoint;
    }

    return points;
  }

  /**
   * Genera puntos uniformemente distribuidos sobre una esfera usando la espiral de Fibonacci (Fibonacci Sphere).
   */
  private generateSphereSeedPoints(
    center: Vector3D,
    radius: number,
    numPoints: number
  ): Vector3D[] {
    const points: Vector3D[] = [];
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

    for (let i = 0; i < numPoints; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const y = 1 - (i / (numPoints - 1 || 1)) * 2; // de +1 a -1
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      points.push(
        center.add(new Vector3D(x * radius, y * radius, z * radius))
      );
    }

    return points;
  }
}
