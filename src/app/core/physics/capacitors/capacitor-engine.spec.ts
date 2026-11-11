import { describe, it, expect } from 'vitest';
import { CapacitorEngine } from './capacitor-engine';
import { DIELECTRIC_MATERIALS } from './dielectric-materials';
import { PHYSICS_CONSTANTS } from '../../math/constants';

describe('CapacitorEngine Scientific Tests', () => {
  const engine = new CapacitorEngine();
  const eps0 = PHYSICS_CONSTANTS.EPSILON_0;

  const vacio = DIELECTRIC_MATERIALS.find((m) => m.id === 'vacio')!;
  const teflon = DIELECTRIC_MATERIALS.find((m) => m.id === 'teflon')!;
  const aire = DIELECTRIC_MATERIALS.find((m) => m.id === 'aire')!;

  it('debe calcular la capacitancia ideal de placas paralelas en vacío exactamente según C = eps0 * A / d', () => {
    const area = 0.01; // 100 cm^2
    const d = 0.002; // 2 mm
    const voltage = 100;

    const result = engine.calculate({
      area,
      separation: d,
      voltage,
      dielectric: vacio,
      insertion: 1.0,
      includeFringing: false,
    });

    const expectedC = (eps0 * area) / d; // ~44.27 pF
    expect(result.capacitance).toBeCloseTo(expectedC, 14);
    expect(result.charge).toBeCloseTo(expectedC * voltage, 12);
    expect(result.electricField).toBeCloseTo(voltage / d, 5); // 50,000 V/m
  });

  it('debe aumentar la capacitancia proporcionalmente a la constante dieléctrica kappa', () => {
    const area = 0.02;
    const d = 0.005;
    const voltage = 200;

    const resVacio = engine.calculate({
      area,
      separation: d,
      voltage,
      dielectric: vacio,
      insertion: 1.0,
    });

    const resTeflon = engine.calculate({
      area,
      separation: d,
      voltage,
      dielectric: teflon, // kappa = 2.1
      insertion: 1.0,
    });

    const ratio = resTeflon.capacitance / resVacio.capacitance;
    expect(ratio).toBeCloseTo(teflon.dielectricConstant, 4);
  });

  it('debe calcular correctamente el modelo de capacitores en paralelo ante inserción parcial del 50%', () => {
    const area = 0.01;
    const d = 0.002;
    const voltage = 50;

    const resPartial = engine.calculate({
      area,
      separation: d,
      voltage,
      dielectric: teflon, // kappa = 2.1
      insertion: 0.5,
    });

    const cVacio = (eps0 * area) / d;
    // Con 50% de inserción: C_eq = C_vacio * (0.5 + 0.5 * 2.1) = C_vacio * 1.55
    const expectedC = cVacio * (0.5 + 0.5 * teflon.dielectricConstant);
    expect(resPartial.capacitance).toBeCloseTo(expectedC, 14);
  });

  it('debe calcular la energía almacenada U = (1/2) * C * V^2 con precisión científica', () => {
    const area = 0.015;
    const d = 0.003;
    const voltage = 300;

    const res = engine.calculate({
      area,
      separation: d,
      voltage,
      dielectric: vacio,
      insertion: 1.0,
    });

    const expectedEnergy = 0.5 * res.capacitance * voltage * voltage;
    expect(res.storedEnergy).toBeCloseTo(expectedEnergy, 10);
  });

  it('debe detectar la ruptura dieléctrica cuando el campo E supera la rigidez máxima', () => {
    const area = 0.01;
    const d = 0.001; // 1 mm
    // Para el aire, breakdown = 3e6 V/m. Con d = 1 mm, V_breakdown = 3000 V.
    // Aplicamos 4000 V -> E = 4e6 V/m > 3e6 V/m
    const res = engine.calculate({
      area,
      separation: d,
      voltage: 4000,
      dielectric: aire,
      insertion: 1.0,
    });

    expect(res.breakdownStatus).toBe('RUPTURA_AIRE');
    expect(res.breakdownStressPercent).toBeGreaterThan(100);
  });

  it('debe incrementar la capacitancia al considerar el efecto de borde de Kirchhoff-Palmer', () => {
    const area = 0.01;
    const d = 0.005;

    const resIdeal = engine.calculate({
      area,
      separation: d,
      voltage: 100,
      dielectric: vacio,
      insertion: 1.0,
      includeFringing: false,
    });

    const resFringing = engine.calculate({
      area,
      separation: d,
      voltage: 100,
      dielectric: vacio,
      insertion: 1.0,
      includeFringing: true,
    });

    expect(resFringing.capacitance).toBeGreaterThan(resIdeal.capacitance);
    expect(resFringing.fringingFactor).toBeGreaterThan(1.0);
  });
});
