import { Vector3D } from '../../math/vector3d';

export interface ParticleState {
  position: Vector3D;
  velocity: Vector3D;
  time: number;
}

export interface LorentzParticleConfig {
  /** Carga eléctrica q [C] (ej. 1.602e-19 para protón, -1.602e-19 para electrón) */
  q: number;
  /** Masa de la partícula m [kg] (ej. 1.673e-27 para protón, 9.109e-31 para electrón) */
  mass: number;
  /** Posición inicial */
  initialPosition: Vector3D;
  /** Velocidad inicial [m/s] */
  initialVelocity: Vector3D;
}

/**
 * Implementación del Algoritmo de Boris (Boris Buneman Scheme).
 * Es el estándar de oro en física de aceleradores y plasmas para integrar la Fuerza de Lorentz:
 * F = q (E + v x B)
 * Desacopla el impulso eléctrico de la rotación pura magnética, conservando de forma exacta
 * la energía cinética (|v| constante cuando E = 0) y el radio de giro de Larmor sin decaimiento numérico.
 */
export class BorisIntegrator {
  /**
   * Avanza un paso temporal dt en el espacio de fase (r, v) bajo campos E(r) y B(r).
   */
  static step(
    currentState: ParticleState,
    electricField: Vector3D,
    magneticField: Vector3D,
    q: number,
    mass: number,
    dt: number
  ): ParticleState {
    const { position: r_n, velocity: v_n, time: t_n } = currentState;

    if (mass <= 0) {
      return currentState;
    }

    const q_m = q / mass;
    const halfDt = 0.5 * dt;

    // 1. Primer medio impulso eléctrico: v_minus = v_n + (q * E / m) * (dt / 2)
    const v_minus = v_n.add(electricField.scale(q_m * halfDt));

    // 2. Rotación magnética pura mediante el esquema de Boris
    // Vector de rotación t = (q * B / m) * (dt / 2)
    const t = magneticField.scale(q_m * halfDt);
    const tNormSq = t.normSquared();

    // Vector de corrección s = 2 * t / (1 + |t|^2)
    const s = t.scale(2.0 / (1.0 + tNormSq));

    // v_prime = v_minus + v_minus x t
    const v_prime = v_minus.add(v_minus.cross(t));

    // v_plus = v_minus + v_prime x s
    const v_plus = v_minus.add(v_prime.cross(s));

    // 3. Segundo medio impulso eléctrico: v_{n+1} = v_plus + (q * E / m) * (dt / 2)
    const v_next = v_plus.add(electricField.scale(q_m * halfDt));

    // 4. Actualización de posición espacial: r_{n+1} = r_n + v_{n+1} * dt
    const r_next = r_n.add(v_next.scale(dt));

    return {
      position: r_next,
      velocity: v_next,
      time: t_n + dt,
    };
  }

  /**
   * Calcula el radio de Larmor (radio de giro o ciclotrónico) teórico:
   * r_L = m * v_perp / (|q| * |B|)
   */
  static calculateLarmorRadius(
    v: Vector3D,
    b: Vector3D,
    q: number,
    mass: number
  ): number {
    const bNorm = b.norm();
    if (bNorm === 0 || q === 0) return Infinity;

    // Descomponer velocidad en componente perpendicular a B
    const bUnit = b.scale(1 / bNorm);
    const vParallel = bUnit.scale(v.dot(bUnit));
    const vPerp = v.sub(vParallel).norm();

    return (mass * vPerp) / (Math.abs(q) * bNorm);
  }

  /**
   * Calcula la frecuencia ciclotrónica teórica:
   * omega_c = |q| * |B| / m
   */
  static calculateCyclotronFrequency(b: Vector3D, q: number, mass: number): number {
    if (mass <= 0) return 0;
    return (Math.abs(q) * b.norm()) / mass;
  }
}
