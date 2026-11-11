export type ComponentType = 'RESISTOR' | 'VOLTAGE_SOURCE' | 'SWITCH' | 'GROUND';

export interface CircuitBranch {
  id: string;
  type: ComponentType;
  /** Nodo de origen (positivo en fuentes de voltaje) */
  nodeFrom: string;
  /** Nodo de destino (negativo en fuentes de voltaje) */
  nodeTo: string;
  /** Valor del componente: Ohmios para resistencia, Voltios para fuente */
  value: number;
  /** Estado para interruptores (true = abierto / no conduce, false = cerrado / conduce) */
  isOpen?: boolean;
  /** Etiqueta descriptiva */
  label: string;
}

export interface BranchResult {
  branchId: string;
  type: ComponentType;
  label: string;
  /** Caída de tensión V = V_from - V_to [V] */
  voltageDrop: number;
  /** Corriente que fluye de nodeFrom a nodeTo [A] */
  current: number;
  /** Potencia disipada o suministrada P = V * I [W] */
  power: number;
}

export interface CircuitSolution {
  /** Potencial de cada nodo respecto a tierra [V] */
  nodeVoltages: Record<string, number>;
  /** Solución detallada para cada rama */
  branchResults: BranchResult[];
  /** Potencia total suministrada por las fuentes [W] */
  totalPowerSupplied: number;
  /** Potencia total disipada por los resistores [W] */
  totalPowerDissipated: number;
  /** Resistencia equivalente total vista por la fuente principal [Ohmios] */
  equivalentResistance?: number;
}
