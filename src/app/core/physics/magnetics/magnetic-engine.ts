import { Vector3D } from '../../math/vector3d';
import { PHYSICS_CONSTANTS } from '../../math/constants';
import { BorisIntegrator, ParticleState, LorentzParticleConfig } from './boris-integrator';

export type MagneticSourceType = 'UNIFORM' | 'WIRE' | 'LOOP' | 'DIPOLE';

export interface MagneticSourceConfig {
  type: MagneticSourceType;
  /** Campo uniforme B [T] */
  uniformB: Vector3D;
  /** Corriente eléctrica I [A] (para alambre o espira) */
  current: number;
  /** Radio R [m] (para espira) */
  loopRadius: number;
  /** Momento dipolar magnético m [A*m²] */
  dipoleMoment: Vector3D;
  /** Posición de la fuente */
  position: Vector3D;
}

export class MagneticEngine {
  private readonly mu0 = PHYSICS_CONSTANTS.MU_0;
  private readonly epsSoft = 0.05; // 5 cm softening para evitar divergencia en el conductor

  /**
   * Calcula el vector de Campo Magnético total B(r) [Tesla] en un punto de prueba r.
   */
  calculateMagneticField(point: Vector3D, config: MagneticSourceConfig): Vector3D {
    switch (config.type) {
      case 'UNIFORM':
        return config.uniformB;

      case 'WIRE': {
        // Conductor recto infinito a lo largo del eje Z pasando por config.position
        const dx = point.x - config.position.x;
        const dy = point.y - config.position.y;
        const rhoSq = dx * dx + dy * dy + this.epsSoft * this.epsSoft;
        const rho = Math.sqrt(rhoSq);

        // B = (mu0 * I / (2 * pi * rho)) * (-sin theta i + cos theta j)
        const factor = (this.mu0 * config.current) / (2 * Math.PI * rhoSq);
        return new Vector3D(-dy * factor, dx * factor, 0);
      }

      case 'LOOP': {
        // Espira circular en el plano XY con radio R y corriente I
        const rPos = point.sub(config.position);
        const R = config.loopRadius;
        const I = config.current;

        // Discretización de Biot-Savart en N segmentos infinitesimales de la espira
        const numSegments = 24;
        let bNet = Vector3D.ZERO;
        const dTheta = (2 * Math.PI) / numSegments;

        for (let k = 0; k < numSegments; k++) {
          const theta = k * dTheta;
          const nextTheta = (k + 1) * dTheta;

          const p1 = new Vector3D(R * Math.cos(theta), R * Math.sin(theta), 0);
          const p2 = new Vector3D(R * Math.cos(nextTheta), R * Math.sin(nextTheta), 0);

          // Vector segmento dl = p2 - p1
          const dl = p2.sub(p1);
          // Punto medio del segmento
          const pMid = p1.add(p2).scale(0.5);

          // Vector desde el segmento al punto de prueba
          const rVec = rPos.sub(pMid);
          const rDistSq = rVec.normSquared() + this.epsSoft * this.epsSoft;
          const rDist = Math.sqrt(rDistSq);

          // dB = (mu0 * I / (4 * pi)) * (dl x rVec) / r^3
          const dlCrossR = dl.cross(rVec);
          const dB = dlCrossR.scale((this.mu0 * I) / (4 * Math.PI * rDistSq * rDist));

          bNet = bNet.add(dB);
        }

        return bNet;
      }

      case 'DIPOLE': {
        // Imán permanente con momento dipolar m en config.position
        const rVec = point.sub(config.position);
        const rSq = rVec.normSquared() + this.epsSoft * this.epsSoft;
        const r = Math.sqrt(rSq);
        const rHat = rVec.scale(1 / r);

        const m = config.dipoleMoment;
        const mDotRHat = m.dot(rHat);

        // B = (mu0 / (4 * pi * r^3)) * (3 * (m . rHat) * rHat - m)
        const factor = this.mu0 / (4 * Math.PI * rSq * r);
        const term = rHat.scale(3 * mDotRHat).sub(m);

        return term.scale(factor);
      }
    }
  }

  /**
   * Simula la trayectoria de una partícula cargada bajo campos E y B mediante el Algoritmo de Boris.
   */
  simulateTrajectory(
    particle: LorentzParticleConfig,
    magneticConfig: MagneticSourceConfig,
    electricField: Vector3D,
    dt = 0.0005,
    maxSteps = 800
  ): ParticleState[] {
    const trajectory: ParticleState[] = [];
    let state: ParticleState = {
      position: particle.initialPosition,
      velocity: particle.initialVelocity,
      time: 0,
    };

    trajectory.push(state);

    for (let step = 0; step < maxSteps; step++) {
      // Evaluar B y E locales
      const bLocal = this.calculateMagneticField(state.position, magneticConfig);
      const eLocal = electricField;

      state = BorisIntegrator.step(
        state,
        eLocal,
        bLocal,
        particle.q,
        particle.mass,
        dt
      );

      trajectory.push(state);

      // Criterio de escape espacial (bounding box)
      if (state.position.norm() > 30.0) {
        break;
      }
    }

    return trajectory;
  }
}
