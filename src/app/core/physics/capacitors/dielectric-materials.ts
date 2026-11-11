/**
 * Base de datos física de materiales dieléctricos comunes.
 * Contiene permitividad relativa (\kappa = \varepsilon_r), rigidez dieléctrica máxima E_breakdown [V/m],
 * color representativo y descripción didáctica.
 */
export interface DielectricMaterial {
  id: string;
  name: string;
  /** Permitividad relativa \kappa = \varepsilon_r (adimensional) */
  dielectricConstant: number;
  /** Rigidez dieléctrica máxima admisible [V/m] */
  breakdownStrength: number;
  /** Color representativo en la simulación 3D (hex) */
  colorHex: number;
  /** Descripción didáctica del material */
  description: string;
}

export const DIELECTRIC_MATERIALS: DielectricMaterial[] = [
  {
    id: 'vacio',
    name: 'Vacío',
    dielectricConstant: 1.0,
    breakdownStrength: Infinity,
    colorHex: 0x38bdf8,
    description: 'Referencia fundamental: ausencia de polarización dieléctrica.',
  },
  {
    id: 'aire',
    name: 'Aire Seco (1 atm)',
    dielectricConstant: 1.00059,
    breakdownStrength: 3.0e6, // 3 kV/mm
    colorHex: 0x94a3b8,
    description: 'Gas dieléctrico estándar. Ruptura por ionización a ~3 kV/mm (3e6 V/m).',
  },
  {
    id: 'teflon',
    name: 'Teflón (PTFE)',
    dielectricConstant: 2.1,
    breakdownStrength: 60.0e6, // 60 kV/mm
    colorHex: 0xe2e8f0,
    description: 'Polímero de baja pérdida y altísima rigidez dieléctrica (60 kV/mm).',
  },
  {
    id: 'papel',
    name: 'Papel Parafinado',
    dielectricConstant: 3.5,
    breakdownStrength: 16.0e6, // 16 kV/mm
    colorHex: 0xfef08a,
    description: 'Utilizado históricamente en capacitores de potencia y condensadores de audio.',
  },
  {
    id: 'vidrio',
    name: 'Vidrio Pyrex',
    dielectricConstant: 5.6,
    breakdownStrength: 14.0e6, // 14 kV/mm
    colorHex: 0x67e8f9,
    description: 'Material cerámico amorfo de rigidez dieléctrica moderada (14 kV/mm).',
  },
  {
    id: 'mica',
    name: 'Mica Natural',
    dielectricConstant: 6.0,
    breakdownStrength: 118.0e6, // 118 kV/mm
    colorHex: 0xfbbf24,
    description: 'Mineral de altísima precisión y estabilidad para radiofrecuencia (118 kV/mm).',
  },
  {
    id: 'titanato',
    name: 'Titanato de Bario (BaTiO₃)',
    dielectricConstant: 1200.0,
    breakdownStrength: 3.0e6, // 3 kV/mm
    colorHex: 0xa855f7,
    description: 'Material ferroeléctrico de constante dieléctrica gigantesca (\u03BA \u2248 1200).',
  },
];
