/**
 * Constantes Físicas Fundamentales en el Sistema Internacional de Unidades (SI).
 * Precisión recomendada por CODATA.
 */
export const PHYSICS_CONSTANTS = {
  /** Permitividad del vacío \varepsilon_0 [F/m] */
  EPSILON_0: 8.8541878128e-12,

  /** Constante de Coulomb k_e = 1 / (4 * \pi * \varepsilon_0) [N*m^2/C^2] */
  K_ELECTROSTATIC: 8.9875517923e9,

  /** Permeabilidad magnética del vacío \mu_0 [T*m/A o H/m] */
  MU_0: 4 * Math.PI * 1e-7,

  /** Carga elemental e [C] */
  ELEMENTARY_CHARGE: 1.602176634e-19,

  /** Masa en reposo del electrón m_e [kg] */
  ELECTRON_MASS: 9.1093837015e-31,

  /** Masa en reposo del protón m_p [kg] */
  PROTON_MASS: 1.67262192369e-27,

  /** Parámetro de suavizado (softening parameter) \epsilon_soft [m] para evitar singularidades en r -> 0 */
  SOFTENING_EPSILON: 1e-4,

  /** Velocidad de la luz en el vacío c [m/s] */
  SPEED_OF_LIGHT: 299792458,
} as const;
