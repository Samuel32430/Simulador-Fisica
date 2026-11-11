import { describe, it, expect } from 'vitest';
import { Vector3D } from '../../math/vector3d';
import { PHYSICS_CONSTANTS } from '../../math/constants';
import { BorisIntegrator } from './boris-integrator';
import { MagneticEngine, MagneticSourceConfig } from './magnetic-engine';

describe('BorisIntegrator and MagneticEngine Scientific Tests', () => {
  const engine = new MagneticEngine();
  const mu0 = PHYSICS_CONSTANTS.MU_0;

  it('debe conservar exactamente la energía cinética bajo campo magnético puro (E = 0)', () => {
    // Parámetros de prueba
    const q = 1.0; // 1 C
    const mass = 1.0; // 1 kg
    const bField = new Vector3D(0, 0, 2.0); // 2 Tesla en Z
    const eField = Vector3D.ZERO;
    const v0 = new Vector3D(5.0, 0, 0); // 5 m/s

    let state = {
      position: Vector3D.ZERO,
      velocity: v0,
      time: 0,
    };

    const initialSpeed = v0.norm();
    const dt = 0.005;

    // Simular 1000 iteraciones
    for (let step = 0; step < 1000; step++) {
      state = BorisIntegrator.step(state, eField, bField, q, mass, dt);
    }

    const finalSpeed = state.velocity.norm();

    // En el esquema de Boris, la velocidad se conserva de forma simpléctica estricta
    expect(finalSpeed).toBeCloseTo(initialSpeed, 5);
  });

  it('debe reproducir el radio de Larmor r_L = m * v_perp / (|q| * B) en órbita circular', () => {
    const q = 2.0;
    const mass = 0.5;
    const bVal = 4.0;
    const vPerp = 8.0;

    const bField = new Vector3D(0, 0, bVal);
    const v0 = new Vector3D(vPerp, 0, 0);

    // Teórico: r_L = (0.5 * 8.0) / (2.0 * 4.0) = 4.0 / 8.0 = 0.5 metros
    const expectedRadius = BorisIntegrator.calculateLarmorRadius(v0, bField, q, mass);
    expect(expectedRadius).toBeCloseTo(0.5, 6);

    // Frecuencia ciclotrónica: omega_c = |q| * B / m = (2 * 4) / 0.5 = 16 rad/s
    const expectedOmega = BorisIntegrator.calculateCyclotronFrequency(bField, q, mass);
    expect(expectedOmega).toBeCloseTo(16.0, 6);
  });

  it('debe cumplir la condición del Selector de Velocidades de Wien: v = E / B genera trayectoria recta', () => {
    // Campos cruzados: B en +Z, E en +Y
    const bZ = 2.0; // 2 Tesla
    const eY = 10.0; // 10 V/m
    // Condición de haz recto: v_x = E / B = 10 / 2 = 5 m/s
    const targetVx = eY / bZ;

    const bField = new Vector3D(0, 0, bZ);
    const eField = new Vector3D(0, eY, 0);

    const q = 1.0;
    const mass = 1.0;
    const v0 = new Vector3D(targetVx, 0, 0);

    let state = {
      position: Vector3D.ZERO,
      velocity: v0,
      time: 0,
    };

    const dt = 0.002;
    for (let i = 0; i < 200; i++) {
      state = BorisIntegrator.step(state, eField, bField, q, mass, dt);
    }

    // La partícula no debe desviarse en el eje Y ni en el eje Z
    expect(state.position.y).toBeCloseTo(0, 3);
    expect(state.position.z).toBeCloseTo(0, 3);
    expect(state.velocity.x).toBeCloseTo(targetVx, 3);
  });

  it('debe calcular el campo magnético analítico de una espira circular en su centro: B_z(0) = mu0 * I / (2 * R)', () => {
    const I = 5.0; // 5 A
    const R = 0.4; // 0.4 m
    const config: MagneticSourceConfig = {
      type: 'LOOP',
      uniformB: Vector3D.ZERO,
      current: I,
      loopRadius: R,
      dipoleMoment: Vector3D.ZERO,
      position: Vector3D.ZERO,
    };

    // Centro de la espira (0, 0, 0)
    const bCenter = engine.calculateMagneticField(Vector3D.ZERO, config);

    // Teórico: B_z = mu0 * I / (2 * R)
    const expectedBz = (mu0 * I) / (2 * R);

    expect(bCenter.x).toBeCloseTo(0, 5);
    expect(bCenter.y).toBeCloseTo(0, 5);
    expect(bCenter.z).toBeCloseTo(expectedBz, 6);
  });

  it('debe calcular el campo azimutal de un alambre recto según la Ley de Biot-Savart / Ampère', () => {
    const I = 10.0; // 10 A
    const config: MagneticSourceConfig = {
      type: 'WIRE',
      uniformB: Vector3D.ZERO,
      current: I,
      loopRadius: 0,
      dipoleMoment: Vector3D.ZERO,
      position: Vector3D.ZERO,
    };

    const testRadius = 0.5; // r = 0.5 m en el eje X: punto (0.5, 0, 0)
    const bPoint = engine.calculateMagneticField(new Vector3D(testRadius, 0, 0), config);

    // El vector debe apuntar en +Y (regla de la mano derecha con corriente en +Z)
    // B_y = mu0 * I / (2 * pi * r)
    const expectedBy = (mu0 * I) / (2 * Math.PI * testRadius);

    expect(bPoint.x).toBeCloseTo(0, 5);
    expect(bPoint.z).toBeCloseTo(0, 5);
    expect(bPoint.y).toBeCloseTo(expectedBy, 5);
  });
});
