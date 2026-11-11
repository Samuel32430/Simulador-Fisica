import { describe, it, expect } from 'vitest';
import { Vector3D } from '../../math/vector3d';
import { PHYSICS_CONSTANTS } from '../../math/constants';
import { CoulombEngine } from './coulomb-engine';
import { createCharge } from './charge3d';
import { TestChargeDynamics } from './test-charge-dynamics';

describe('CoulombEngine Scientific Tests', () => {
  const engine = new CoulombEngine();
  const k = PHYSICS_CONSTANTS.K_ELECTROSTATIC;

  it('debe calcular el campo eléctrico exacto de una carga puntual aislada', () => {
    const q = 1e-6; // 1 \mu C
    const charge = createCharge('q1', q, new Vector3D(0, 0, 0));
    const r = 2.0; // 2 metros
    const point = new Vector3D(r, 0, 0);

    const eField = engine.calculateElectricField(point, [charge]);

    // Teórico: E = k * q / r^2
    const eExpected = (k * q) / (r * r);

    expect(eField.y).toBeCloseTo(0, 5);
    expect(eField.z).toBeCloseTo(0, 5);
    expect(eField.x).toBeCloseTo(eExpected, -1); // Precisión científica
  });

  it('debe validar la simetría y potencial nulo en el punto medio de un dipolo eléctrico', () => {
    const d = 1.0; // Separación de 1 metro
    const q = 2e-6; // 2 \mu C

    const positiveCharge = createCharge('q_plus', +q, new Vector3D(0, 0, d / 2));
    const negativeCharge = createCharge('q_minus', -q, new Vector3D(0, 0, -d / 2));

    const origin = Vector3D.ZERO;

    // En el origen, el potencial de un dipolo es idénticamente 0
    const potentialAtOrigin = engine.calculatePotential(origin, [
      positiveCharge,
      negativeCharge,
    ]);
    expect(potentialAtOrigin).toBeCloseTo(0, 3);

    // El campo eléctrico en el origen apunta hacia la carga negativa (-Z)
    // E_z = -2 * k * q / (d/2)^2
    const eField = engine.calculateElectricField(origin, [
      positiveCharge,
      negativeCharge,
    ]);
    const expectedEz = -2 * ((k * q) / ((d / 2) * (d / 2)));

    expect(eField.x).toBeCloseTo(0, 4);
    expect(eField.y).toBeCloseTo(0, 4);
    expect(eField.z).toBeCloseTo(expectedEz, -1);
  });

  it('debe simular la trayectoria de una partícula de prueba sin generar valores NaN o divergentes', () => {
    const charge = createCharge('source', 5e-6, Vector3D.ZERO);
    const dynamics = new TestChargeDynamics();

    const trajectory = dynamics.simulateTrajectory(
      {
        q: -1e-6, // Partícula atractiva (-1 \mu C)
        mass: 1e-4, // 0.1 gramos
        initialPosition: new Vector3D(3, 1, 0),
        initialVelocity: new Vector3D(0, 0.5, 0),
        dt: 0.005,
        maxSteps: 50,
      },
      [charge]
    );

    expect(trajectory.length).toBeGreaterThan(10);
    for (const pt of trajectory) {
      expect(Number.isNaN(pt.position.x)).toBe(false);
      expect(Number.isNaN(pt.velocity.y)).toBe(false);
      expect(Number.isFinite(pt.kineticEnergy)).toBe(true);
    }
  });
});
