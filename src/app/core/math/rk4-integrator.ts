import { Vector3D } from './vector3d';

/**
 * Función que define una derivada de primer orden vectorial: d(state)/dt = f(t, state).
 */
export type DerivativeFunction = (t: number, state: Vector3D) => Vector3D;

/**
 * Estado completo de una partícula dinámica (posición y velocidad).
 */
export interface PhaseSpaceState {
  position: Vector3D;
  velocity: Vector3D;
}

/**
 * Integrador numérico Runge-Kutta de 4to Orden (RK4).
 * Proporciona un error de truncamiento local de O(dt^5) y global de O(dt^4).
 */
export class RK4Integrator {
  /**
   * Avanza un paso en una ecuación diferencial d(state)/dt = f(t, state) mediante RK4.
   */
  static step(
    derivative: DerivativeFunction,
    t: number,
    state: Vector3D,
    dt: number
  ): Vector3D {
    const k1 = derivative(t, state);
    const k2 = derivative(t + 0.5 * dt, state.add(k1.scale(0.5 * dt)));
    const k3 = derivative(t + 0.5 * dt, state.add(k2.scale(0.5 * dt)));
    const k4 = derivative(t + dt, state.add(k3.scale(dt)));

    const delta = k1
      .add(k2.scale(2))
      .add(k3.scale(2))
      .add(k4)
      .scale(dt / 6);

    return state.add(delta);
  }

  /**
   * Avanza un paso en el espacio de fase (posición y velocidad) bajo aceleración dependiente de posición y velocidad:
   * dr/dt = v
   * dv/dt = a(t, r, v)
   */
  static stepPhaseSpace(
    accelerationFn: (t: number, pos: Vector3D, vel: Vector3D) => Vector3D,
    t: number,
    currentState: PhaseSpaceState,
    dt: number
  ): PhaseSpaceState {
    const { position: r0, velocity: v0 } = currentState;

    // k1
    const v_k1 = v0;
    const a_k1 = accelerationFn(t, r0, v0);

    // k2
    const r_mid1 = r0.add(v_k1.scale(0.5 * dt));
    const v_mid1 = v0.add(a_k1.scale(0.5 * dt));
    const v_k2 = v_mid1;
    const a_k2 = accelerationFn(t + 0.5 * dt, r_mid1, v_mid1);

    // k3
    const r_mid2 = r0.add(v_k2.scale(0.5 * dt));
    const v_mid2 = v0.add(a_k2.scale(0.5 * dt));
    const v_k3 = v_mid2;
    const a_k3 = accelerationFn(t + 0.5 * dt, r_mid2, v_mid2);

    // k4
    const r_end = r0.add(v_k3.scale(dt));
    const v_end = v0.add(a_k3.scale(dt));
    const v_k4 = v_end;
    const a_k4 = accelerationFn(t + dt, r_end, v_end);

    // Posición final
    const r_next = r0.add(
      v_k1
        .add(v_k2.scale(2))
        .add(v_k3.scale(2))
        .add(v_k4)
        .scale(dt / 6)
    );

    // Velocidad final
    const v_next = v0.add(
      a_k1
        .add(a_k2.scale(2))
        .add(a_k3.scale(2))
        .add(a_k4)
        .scale(dt / 6)
    );

    return {
      position: r_next,
      velocity: v_next,
    };
  }
}
