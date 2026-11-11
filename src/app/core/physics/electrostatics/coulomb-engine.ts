import { Vector3D } from '../../math/vector3d';
import { PHYSICS_CONSTANTS } from '../../math/constants';
import { Charge3D } from './charge3d';

/**
 * Motor computacional para electrostática.
 * Aplica el principio de superposición lineal para la Ley de Coulomb y el Potencial Eléctrico.
 */
export class CoulombEngine {
  private readonly k = PHYSICS_CONSTANTS.K_ELECTROSTATIC;
  private readonly epsSoft = PHYSICS_CONSTANTS.SOFTENING_EPSILON;

  /**
   * Calcula el vector de Campo Eléctrico neto E(r) [N/C o V/m] en un punto de prueba r.
   * E(r) = k * sum_i (q_i * (r - r_i) / |r - r_i|^3)
   */
  calculateElectricField(point: Vector3D, charges: Charge3D[]): Vector3D {
    let field = Vector3D.ZERO;

    for (const ch of charges) {
      if (ch.q === 0) continue;

      const delta = point.sub(ch.position);
      // Regularización con softening para evitar divergencia infinita en r = r_i
      const distSq = delta.normSquared() + this.epsSoft * this.epsSoft;
      const dist = Math.sqrt(distSq);
      const factor = (this.k * ch.q) / (distSq * dist);

      field = field.add(delta.scale(factor));
    }

    return field;
  }

  /**
   * Calcula el Potencial Eléctrico escalar neto V(r) [V] en un punto de prueba r.
   * V(r) = k * sum_i (q_i / |r - r_i|)
   */
  calculatePotential(point: Vector3D, charges: Charge3D[]): number {
    let totalPotential = 0;

    for (const ch of charges) {
      if (ch.q === 0) continue;

      const dist = Math.sqrt(
        point.distanceSquared(ch.position) + this.epsSoft * this.epsSoft
      );
      totalPotential += (this.k * ch.q) / dist;
    }

    return totalPotential;
  }

  /**
   * Calcula la Fuerza de Coulomb sobre una partícula de prueba con carga q_test colocada en r.
   * F = q_test * E(r)
   */
  calculateForceOnCharge(
    testChargeQ: number,
    point: Vector3D,
    charges: Charge3D[]
  ): Vector3D {
    const field = this.calculateElectricField(point, charges);
    return field.scale(testChargeQ);
  }

  /**
   * Calcula la energía potencial electrostática total del ensamble de cargas:
   * U = (1/2) * k * sum_{i != j} (q_i * q_j / |r_i - r_j|)
   */
  calculateTotalElectrostaticEnergy(charges: Charge3D[]): number {
    let totalEnergy = 0;
    const n = charges.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = Math.sqrt(
          charges[i].position.distanceSquared(charges[j].position) +
            this.epsSoft * this.epsSoft
        );
        totalEnergy += (this.k * charges[i].q * charges[j].q) / dist;
      }
    }

    return totalEnergy;
  }
}
