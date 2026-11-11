import { PHYSICS_CONSTANTS } from '../../math/constants';
import { DielectricMaterial, DIELECTRIC_MATERIALS } from './dielectric-materials';

export interface CapacitorInput {
  /** Área de las placas A [m²] (ej. 0.01 m² = 100 cm²) */
  area: number;
  /** Separación entre placas d [m] (ej. 0.005 m = 5 mm) */
  separation: number;
  /** Diferencia de potencial V [V] (ej. 100 V) */
  voltage: number;
  /** Material dieléctrico */
  dielectric: DielectricMaterial;
  /** Fracción de inserción del dieléctrico [0.0 a 1.0] */
  insertion: number;
  /** Incluir corrección por efecto de borde (Kirchhoff-Palmer) */
  includeFringing?: boolean;
}

export type BreakdownStatus = 'SEGURO' | 'PRECAUCION' | 'RUPTURA_AIRE' | 'RUPTURA_DIELECTRICO' | 'RUPTURA_TOTAL';

export interface CapacitorCalculationResult {
  /** Capacitancia ideal C [F] */
  capacitanceIdeal: number;
  /** Capacitancia real con efecto de borde C [F] */
  capacitanceReal: number;
  /** Capacitancia efectiva utilizada C [F] */
  capacitance: number;
  /** Carga total almacenada Q [C] */
  charge: number;
  /** Densidad de carga superficial \sigma [C/m²] */
  surfaceChargeDensity: number;
  /** Campo eléctrico uniforme entre placas E [V/m] */
  electricField: number;
  /** Energía electrostática total almacenada U [J] */
  storedEnergy: number;
  /** Densidad volumétrica media de energía u_E [J/m³] */
  energyDensity: number;
  /** Estado de ruptura dieléctrica */
  breakdownStatus: BreakdownStatus;
  /** Porcentaje de esfuerzo sobre el dieléctrico o aire (100% = límite) */
  breakdownStressPercent: number;
  /** Factor de incremento por efecto de borde (1.0 = ideal) */
  fringingFactor: number;
}

export class CapacitorEngine {
  private readonly eps0 = PHYSICS_CONSTANTS.EPSILON_0;
  private readonly airBreakdown = 3.0e6; // 3 kV/mm para el aire

  /**
   * Calcula todos los parámetros electrostáticos del capacitor de placas paralelas.
   */
  calculate(input: CapacitorInput): CapacitorCalculationResult {
    const { area, separation, voltage, dielectric } = input;
    const insertion = Math.max(0, Math.min(1, input.insertion ?? 1));
    const includeFringing = input.includeFringing ?? false;

    // 1. Modelo de placas paralelas con dieléctrico parcial (dos capacitores en paralelo)
    // A_diel = area * insertion, A_vacio = area * (1 - insertion)
    // C_ideal = (eps0 * area / separation) * [ (1 - insertion) + kappa * insertion ]
    const kappa = dielectric.dielectricConstant;
    const effectiveKappa = (1 - insertion) + kappa * insertion;
    const cIdeal = (this.eps0 * area * effectiveKappa) / separation;

    // 2. Corrección de efecto de borde de Kirchhoff-Palmer
    // C_real = C_ideal * [ 1 + (d / (pi * sqrt(A))) * (1 + ln( (2 * pi * sqrt(A)) / d )) ]
    const sqrtA = Math.sqrt(area);
    let fringingFactor = 1.0;
    if (sqrtA > 0 && separation > 0) {
      const ratio = (2 * Math.PI * sqrtA) / separation;
      if (ratio > 1) {
        fringingFactor = 1 + (separation / (Math.PI * sqrtA)) * (1 + Math.log(ratio));
      }
    }

    const cReal = cIdeal * fringingFactor;
    const capacitance = includeFringing ? cReal : cIdeal;

    // 3. Carga y densidad superficial
    const charge = capacitance * voltage;
    const surfaceChargeDensity = area > 0 ? charge / area : 0;

    // 4. Campo eléctrico uniforme E = V / d
    const electricField = separation > 0 ? Math.abs(voltage) / separation : 0;

    // 5. Energía almacenada U = (1/2) * C * V^2
    const storedEnergy = 0.5 * capacitance * voltage * voltage;

    // 6. Densidad volumétrica de energía u_E = (1/2) * eps_eff * eps0 * E^2
    const energyDensity = 0.5 * effectiveKappa * this.eps0 * electricField * electricField;

    // 7. Diagnóstico de ruptura dieléctrica
    // Comprobamos la región de aire (si insertion < 1) y la del dieléctrico (si insertion > 0)
    let airBroken = false;
    let dielBroken = false;
    let maxStress = 0;

    // Estrés en la zona de aire
    if (insertion < 1.0) {
      const airStress = (electricField / this.airBreakdown) * 100;
      maxStress = Math.max(maxStress, airStress);
      if (electricField >= this.airBreakdown) {
        airBroken = true;
      }
    }

    // Estrés en la zona dieléctrica
    if (insertion > 0.0 && isFinite(dielectric.breakdownStrength)) {
      const dielStress = (electricField / dielectric.breakdownStrength) * 100;
      maxStress = Math.max(maxStress, dielStress);
      if (electricField >= dielectric.breakdownStrength) {
        dielBroken = true;
      }
    }

    let breakdownStatus: BreakdownStatus = 'SEGURO';
    if (airBroken && dielBroken) {
      breakdownStatus = 'RUPTURA_TOTAL';
    } else if (airBroken || (dielBroken && dielectric.id === 'aire')) {
      breakdownStatus = 'RUPTURA_AIRE';
    } else if (dielBroken) {
      breakdownStatus = 'RUPTURA_DIELECTRICO';
    } else if (maxStress >= 75) {
      breakdownStatus = 'PRECAUCION';
    }

    return {
      capacitanceIdeal: cIdeal,
      capacitanceReal: cReal,
      capacitance,
      charge,
      surfaceChargeDensity,
      electricField,
      storedEnergy,
      energyDensity,
      breakdownStatus,
      breakdownStressPercent: Math.min(maxStress, 999),
      fringingFactor,
    };
  }

  /**
   * Genera una curva de barrido de capacitancia variando la distancia d para graficación 2D.
   */
  generateCapacitanceVsDistanceCurve(
    area: number,
    dielectric: DielectricMaterial,
    insertion: number,
    dMin = 0.001,
    dMax = 0.02,
    steps = 30
  ): { distanceMm: number; capacitancePf: number }[] {
    const points: { distanceMm: number; capacitancePf: number }[] = [];
    const stepSize = (dMax - dMin) / steps;

    for (let i = 0; i <= steps; i++) {
      const d = dMin + i * stepSize;
      const res = this.calculate({
        area,
        separation: d,
        voltage: 100,
        dielectric,
        insertion,
        includeFringing: false,
      });
      points.push({
        distanceMm: d * 1000,
        capacitancePf: res.capacitance * 1e12,
      });
    }

    return points;
  }
}
