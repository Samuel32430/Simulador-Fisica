import { PHYSICS_CONSTANTS } from '../../math/constants';

export interface OhmCalculationInput {
  /** Voltaje V [V] */
  voltage: number;
  /** Resistencia R [\Omega] */
  resistance: number;
  /** Longitud del conductor L [m] */
  wireLength?: number;
  /** Sección transversal del conductor A_wire [m²] */
  wireCrossSectionArea?: number;
}

export interface OhmCalculationResult {
  voltage: number;
  resistance: number;
  /** Corriente eléctrica I = V / R [A] */
  current: number;
  /** Potencia disipada P = V * I = I^2 * R [W] */
  power: number;
  /** Velocidad de deriva de electrones v_d [m/s] en cobre típico (n \approx 8.5e28 e-/m³) */
  driftVelocity: number;
  /** Temperatura estimada del resistor por calentamiento Joule [°C] */
  estimatedTemperatureC: number;
}

export class OhmEngine {
  // Densidad de electrones libres en cobre: n \approx 8.49 \times 10^{28} electrones/m³
  private readonly freeElectronDensityCopper = 8.49e28;
  private readonly elementaryCharge = PHYSICS_CONSTANTS.ELEMENTARY_CHARGE;

  calculate(input: OhmCalculationInput): OhmCalculationResult {
    const v = input.voltage;
    const r = Math.max(input.resistance, 1e-4);

    const i = v / r;
    const p = v * i;

    // Área transversal por defecto (alambre de calibre AWG 20 \approx 0.5 mm² = 5e-7 m²)
    const area = input.wireCrossSectionArea ?? 5e-7;

    // Velocidad de deriva v_d = I / (n * e * A)
    const driftVelocity = i / (this.freeElectronDensityCopper * this.elementaryCharge * area);

    // Estimación simplificada de temperatura: T = T_ambiente (20°C) + k_dissipation * P
    // Para un resistor de 1/4W a 2W en aire libre, \Delta T \approx 12 °C/W
    const estimatedTemperatureC = 20.0 + 12.0 * p;

    return {
      voltage: v,
      resistance: r,
      current: i,
      power: p,
      driftVelocity,
      estimatedTemperatureC,
    };
  }

  /**
   * Genera los puntos para la curva característica lineal V vs I de la Ley de Ohm.
   */
  generateVICharacteristics(r: number, maxV = 30, steps = 15): { v: number; i: number }[] {
    const pts: { v: number; i: number }[] = [];
    const stepV = maxV / steps;

    for (let step = 0; step <= steps; step++) {
      const v = step * stepV;
      pts.push({
        v,
        i: v / Math.max(r, 1e-4),
      });
    }

    return pts;
  }
}
