import { describe, it, expect } from 'vitest';
import { MnaCircuitSolver } from './mna-solver';
import { CircuitBranch } from './circuit-types';
import { OhmEngine } from './ohm-engine';

describe('MNA Circuit Solver and OhmEngine Scientific Tests', () => {
  const solver = new MnaCircuitSolver();
  const ohmEngine = new OhmEngine();

  it('debe resolver un circuito elemental de 1 malla según la Ley de Ohm: I = V / R', () => {
    // Fuente V1 de 12V conectada entre nodo '1' (+) y '0' (tierra)
    // Resistor R1 de 4 Ohmios conectado entre nodo '1' y '0'
    const branches: CircuitBranch[] = [
      { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: 12, label: 'V1 (12V)' },
      { id: 'r1', type: 'RESISTOR', nodeFrom: '1', nodeTo: '0', value: 4, label: 'R1 (4Ω)' },
    ];

    const solution = solver.solve(branches, '0');

    expect(solution.nodeVoltages['1']).toBeCloseTo(12, 5);
    expect(solution.nodeVoltages['0']).toBe(0);

    const rResult = solution.branchResults.find((b) => b.branchId === 'r1')!;
    expect(rResult.current).toBeCloseTo(3, 5); // 12 / 4 = 3 A
    expect(rResult.power).toBeCloseTo(36, 5); // 12 * 3 = 36 W
    expect(solution.equivalentResistance).toBeCloseTo(4, 5);
  });

  it('debe resolver un circuito serie con divisor de tensión (Kirchhoff de Voltaje)', () => {
    // V1 = 12V entre '1' y '0'
    // R1 = 2 Ohmios entre '1' y '2'
    // R2 = 4 Ohmios entre '2' y '0'
    // I_esperada = 12 / (2 + 4) = 2 A
    // V(nodo 2) = 12 - 2*2 = 8 V
    const branches: CircuitBranch[] = [
      { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: 12, label: 'V1' },
      { id: 'r1', type: 'RESISTOR', nodeFrom: '1', nodeTo: '2', value: 2, label: 'R1' },
      { id: 'r2', type: 'RESISTOR', nodeFrom: '2', nodeTo: '0', value: 4, label: 'R2' },
    ];

    const solution = solver.solve(branches, '0');

    expect(solution.nodeVoltages['1']).toBeCloseTo(12, 5);
    expect(solution.nodeVoltages['2']).toBeCloseTo(8, 5);

    const r1 = solution.branchResults.find((b) => b.branchId === 'r1')!;
    const r2 = solution.branchResults.find((b) => b.branchId === 'r2')!;

    expect(r1.current).toBeCloseTo(2, 5);
    expect(r2.current).toBeCloseTo(2, 5);
    expect(r1.voltageDrop).toBeCloseTo(4, 5); // 12 - 8 = 4V
    expect(r2.voltageDrop).toBeCloseTo(8, 5); // 8 - 0 = 8V
    expect(solution.equivalentResistance).toBeCloseTo(6, 5);
  });

  it('debe resolver un circuito paralelo con divisor de corriente (Kirchhoff de Corriente)', () => {
    // V1 = 12V entre '1' y '0'
    // R1 = 6 Ohmios en paralelo entre '1' y '0' (I1 = 12/6 = 2A)
    // R2 = 12 Ohmios en paralelo entre '1' y '0' (I2 = 12/12 = 1A)
    // I_total = 3A, Req = (6*12)/(6+12) = 4 Ohmios
    const branches: CircuitBranch[] = [
      { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: 12, label: 'V1' },
      { id: 'r1', type: 'RESISTOR', nodeFrom: '1', nodeTo: '0', value: 6, label: 'R1' },
      { id: 'r2', type: 'RESISTOR', nodeFrom: '1', nodeTo: '0', value: 12, label: 'R2' },
    ];

    const solution = solver.solve(branches, '0');

    const r1 = solution.branchResults.find((b) => b.branchId === 'r1')!;
    const r2 = solution.branchResults.find((b) => b.branchId === 'r2')!;
    const v1 = solution.branchResults.find((b) => b.branchId === 'v1')!;

    expect(r1.current).toBeCloseTo(2, 5);
    expect(r2.current).toBeCloseTo(1, 5);
    expect(v1.current).toBeCloseTo(3, 5);
    expect(solution.equivalentResistance).toBeCloseTo(4, 5);
  });

  it('debe validar la condición de equilibrio del Puente de Wheatstone (V_CD = 0)', () => {
    // Puente de Wheatstone alimentado con 10V:
    // Nodo '1' es el riel positivo (10V), Nodo '0' es tierra.
    // Rama izquierda: R1 ('1' a 'C') = 100Ω, R2 ('C' a '0') = 100Ω -> V(C) = 5V
    // Rama derecha:   R3 ('1' a 'D') = 200Ω, R4 ('D' a '0') = 200Ω -> V(D) = 5V
    // Detector central: R_galv ('C' a 'D') = 50Ω
    // Al estar equilibrado R1/R2 = R3/R4 = 1 -> V_CD = V(C) - V(D) = 0, I_galv = 0
    const branches: CircuitBranch[] = [
      { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: 10, label: 'V1' },
      { id: 'r1', type: 'RESISTOR', nodeFrom: '1', nodeTo: 'C', value: 100, label: 'R1' },
      { id: 'r2', type: 'RESISTOR', nodeFrom: 'C', nodeTo: '0', value: 100, label: 'R2' },
      { id: 'r3', type: 'RESISTOR', nodeFrom: '1', nodeTo: 'D', value: 200, label: 'R3' },
      { id: 'r4', type: 'RESISTOR', nodeFrom: 'D', nodeTo: '0', value: 200, label: 'R4' },
      { id: 'rg', type: 'RESISTOR', nodeFrom: 'C', nodeTo: 'D', value: 50, label: 'R_detector' },
    ];

    const solution = solver.solve(branches, '0');

    expect(solution.nodeVoltages['C']).toBeCloseTo(5.0, 4);
    expect(solution.nodeVoltages['D']).toBeCloseTo(5.0, 4);

    const rg = solution.branchResults.find((b) => b.branchId === 'rg')!;
    expect(rg.current).toBeCloseTo(0, 5);
    expect(rg.voltageDrop).toBeCloseTo(0, 5);
  });

  it('debe interrumpir el flujo de corriente cuando un interruptor se encuentra abierto', () => {
    const branchesOpen: CircuitBranch[] = [
      { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: 10, label: 'V1' },
      { id: 'sw1', type: 'SWITCH', nodeFrom: '1', nodeTo: '2', value: 0, isOpen: true, label: 'SW1' },
      { id: 'r1', type: 'RESISTOR', nodeFrom: '2', nodeTo: '0', value: 10, label: 'R1' },
    ];

    const solOpen = solver.solve(branchesOpen, '0');
    const rOpen = solOpen.branchResults.find((b) => b.branchId === 'r1')!;
    expect(rOpen.current).toBeCloseTo(0, 5);

    // Al cerrar el interruptor
    const branchesClosed: CircuitBranch[] = [
      { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: 10, label: 'V1' },
      { id: 'sw1', type: 'SWITCH', nodeFrom: '1', nodeTo: '2', value: 0, isOpen: false, label: 'SW1' },
      { id: 'r1', type: 'RESISTOR', nodeFrom: '2', nodeTo: '0', value: 10, label: 'R1' },
    ];

    const solClosed = solver.solve(branchesClosed, '0');
    const rClosed = solClosed.branchResults.find((b) => b.branchId === 'r1')!;
    expect(rClosed.current).toBeCloseTo(1.0, 2); // 10V / 10Ω = 1 A
  });

  it('debe calcular la velocidad de deriva y potencia disipada con OhmEngine', () => {
    const result = ohmEngine.calculate({
      voltage: 12,
      resistance: 4,
    });

    expect(result.current).toBeCloseTo(3.0, 5);
    expect(result.power).toBeCloseTo(36.0, 5);
    expect(result.driftVelocity).toBeGreaterThan(0);
    expect(result.estimatedTemperatureC).toBeGreaterThan(20);
  });
});
