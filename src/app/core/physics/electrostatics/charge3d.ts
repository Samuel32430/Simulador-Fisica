import { Vector3D } from '../../math/vector3d';

/**
 * Entidad física de una carga eléctrica puntual en el espacio 3D.
 */
export interface Charge3D {
  id: string;
  /** Carga en Coulombs [C] (ej. +5e-6 para +5 \mu C) */
  q: number;
  /** Posición en el espacio [m] */
  position: Vector3D;
  /** Si la carga está anclada espacialmente o es libre de moverse */
  isFixed?: boolean;
  /** Masa de la partícula [kg] (por defecto 1e-15 o masa de protón/electrón) */
  mass?: number;
  /** Velocidad de la partícula [m/s] si es móvil */
  velocity?: Vector3D;
  /** Etiqueta visible en la interfaz */
  label?: string;
}

/**
 * Crea una carga puntual con valores seguros por defecto.
 */
export function createCharge(
  id: string,
  q: number,
  position: Vector3D,
  options: Partial<Omit<Charge3D, 'id' | 'q' | 'position'>> = {}
): Charge3D {
  return {
    id,
    q,
    position,
    isFixed: options.isFixed ?? true,
    mass: options.mass ?? 1e-15,
    velocity: options.velocity ?? Vector3D.ZERO,
    label: options.label ?? `q_${id}`,
  };
}
