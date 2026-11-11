import { Vector3D } from '../../math/vector3d';
import { RK4Integrator, PhaseSpaceState } from '../../math/rk4-integrator';
import { Charge3D } from './charge3d';
import { CoulombEngine } from './coulomb-engine';

export interface ParticleTrajectoryConfig {
  /** Carga de la partícula de prueba [C] (ej. -1.6e-19 para electrón o +1e-6) */
  q: number;
  /** Masa de la partícula de prueba [kg] */
  mass: number;
  /** Posición inicial */
  initialPosition: Vector3D;
  /** Velocidad inicial [m/s] */
  initialVelocity: Vector3D;
  /** Paso temporal dt [s] */
  dt: number;
  /** Máximo número de pasos */
  maxSteps: number;
}

export interface TrajectoryPoint {
  time: number;
  position: Vector3D;
  velocity: Vector3D;
  kineticEnergy: number;
  potential: number;
}

/**
 * Simulador de trayectorias para partículas cargadas libres en campos electrostáticos.
 */
export class TestChargeDynamics {
  private engine = new CoulombEngine();

  simulateTrajectory(
    config: ParticleTrajectoryConfig,
    fixedCharges: Charge3D[]
  ): TrajectoryPoint[] {
    const trajectory: TrajectoryPoint[] = [];
    let state: PhaseSpaceState = {
      position: config.initialPosition,
      velocity: config.initialVelocity,
    };
    let t = 0;

    const accelerationFn = (_time: number, pos: Vector3D, _vel: Vector3D): Vector3D => {
      const eField = this.engine.calculateElectricField(pos, fixedCharges);
      const force = eField.scale(config.q);
      return force.scale(1 / config.mass);
    };

    for (let step = 0; step < config.maxSteps; step++) {
      const speedSq = state.velocity.normSquared();
      const kinetic = 0.5 * config.mass * speedSq;
      const pot = this.engine.calculatePotential(state.position, fixedCharges);

      trajectory.push({
        time: t,
        position: state.position,
        velocity: state.velocity,
        kineticEnergy: kinetic,
        potential: pot,
      });

      // Escape check
      if (state.position.norm() > 25.0) break;

      // Colisión con alguna carga fija
      let collided = false;
      for (const ch of fixedCharges) {
        if (state.position.distanceTo(ch.position) < 0.1) {
          collided = true;
          break;
        }
      }
      if (collided) break;

      state = RK4Integrator.stepPhaseSpace(
        accelerationFn,
        t,
        state,
        config.dt
      );
      t += config.dt;
    }

    return trajectory;
  }
}
