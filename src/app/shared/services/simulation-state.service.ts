import { Injectable, signal, computed } from '@angular/core';
import { Charge3D, createCharge } from '../../core/physics/electrostatics/charge3d';
import { Vector3D } from '../../core/math/vector3d';
import { CoulombEngine } from '../../core/physics/electrostatics/coulomb-engine';

export type SimulationUnit = 'u1' | 'u2' | 'u3' | 'u4';

export interface UnitInfo {
  id: SimulationUnit;
  title: string;
  badge: string;
  description: string;
}

export const SIMULATION_UNITS: UnitInfo[] = [
  {
    id: 'u1',
    title: 'Unidad 1: Electrostática y Potencial',
    badge: 'Campo Eléctrico 3D',
    description: 'Visualizador de cargas, líneas de campo RK4, superficies equipotenciales y trayectorias.',
  },
  {
    id: 'u2',
    title: 'Unidad 2: Capacitores y Dieléctricos',
    badge: 'Capacitancia',
    description: 'Placas paralelas, variación de área, distancia, constante dieléctrica y energía almacenada.',
  },
  {
    id: 'u3',
    title: 'Unidad 3: Corriente y Ley de Ohm',
    badge: 'Circuitos MNA',
    description: 'Simulador de circuitos serie, paralelo y mixto con análisis nodal y Ley de Ohm en tiempo real.',
  },
  {
    id: 'u4',
    title: 'Unidad 4: Magnetismo y Fuerza de Lorentz',
    badge: 'Campos E y B',
    description: 'Biot-Savart, dipolos magnéticos y dinámica de partículas bajo el Algoritmo de Boris.',
  },
];

@Injectable({
  providedIn: 'root',
})
export class SimulationStateService {
  private engine = new CoulombEngine();

  // Unidad activa
  readonly currentUnit = signal<SimulationUnit>('u1');

  // Estado de electrostática (Unidad 1)
  readonly charges = signal<Charge3D[]>([
    createCharge('1', 5e-6, new Vector3D(-1.2, 0, 0), { label: 'q₁ (+5 µC)' }),
    createCharge('2', -5e-6, new Vector3D(1.2, 0, 0), { label: 'q₂ (-5 µC)' }),
  ]);

  readonly selectedChargeId = signal<string | null>('1');

  // Opciones de visualización 3D
  readonly showFieldVectors = signal<boolean>(true);
  readonly showFieldLines = signal<boolean>(true);
  readonly showEquipotentials = signal<boolean>(false);
  readonly vectorDensity = signal<'baja' | 'media' | 'alta'>('media');

  // Sonda de medición virtual (coordenada de prueba)
  readonly probePosition = signal<Vector3D>(new Vector3D(0, 0.8, 0));

  // Medición calculada en tiempo real en la sonda
  readonly probeMeasurement = computed(() => {
    const pos = this.probePosition();
    const chs = this.charges();
    const field = this.engine.calculateElectricField(pos, chs);
    const potential = this.engine.calculatePotential(pos, chs);

    return {
      field,
      fieldMagnitude: field.norm(),
      potential,
    };
  });

  // Energía electrostática total del ensamble
  readonly totalSystemEnergy = computed(() => {
    return this.engine.calculateTotalElectrostaticEnergy(this.charges());
  });

  // Carga seleccionada
  readonly selectedCharge = computed(() => {
    const id = this.selectedChargeId();
    if (!id) return null;
    return this.charges().find((c) => c.id === id) ?? null;
  });

  setUnit(unit: SimulationUnit): void {
    this.currentUnit.set(unit);
  }

  addCharge(qMicroCoulombs: number, position?: Vector3D): void {
    const current = this.charges();
    if (current.length >= 10) {
      alert('Límite alcanzado: El simulador soporta hasta 10 cargas simultáneas.');
      return;
    }

    const nextId = (
      Math.max(0, ...current.map((c) => parseInt(c.id, 10) || 0)) + 1
    ).toString();

    const pos =
      position ??
      new Vector3D(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        0
      );

    const sign = qMicroCoulombs >= 0 ? '+' : '';
    const newCh = createCharge(nextId, qMicroCoulombs * 1e-6, pos, {
      label: `q${nextId} (${sign}${qMicroCoulombs} µC)`,
    });

    this.charges.update((list) => [...list, newCh]);
    this.selectedChargeId.set(nextId);
  }

  removeCharge(id: string): void {
    this.charges.update((list) => list.filter((c) => c.id !== id));
    if (this.selectedChargeId() === id) {
      const remaining = this.charges();
      this.selectedChargeId.set(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  updateCharge(id: string, updates: Partial<Charge3D>): void {
    this.charges.update((list) =>
      list.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  setProbePosition(pos: Vector3D): void {
    this.probePosition.set(pos);
  }

  // Presets didácticos
  loadPreset(presetName: 'dipolo' | 'cuadripolo' | 'monopolo' | 'linea'): void {
    switch (presetName) {
      case 'dipolo':
        this.charges.set([
          createCharge('1', 5e-6, new Vector3D(-1.2, 0, 0), { label: 'q₁ (+5 µC)' }),
          createCharge('2', -5e-6, new Vector3D(1.2, 0, 0), { label: 'q₂ (-5 µC)' }),
        ]);
        break;
      case 'cuadripolo':
        this.charges.set([
          createCharge('1', 4e-6, new Vector3D(-1, 1, 0), { label: 'q₁ (+4 µC)' }),
          createCharge('2', -4e-6, new Vector3D(1, 1, 0), { label: 'q₂ (-4 µC)' }),
          createCharge('3', 4e-6, new Vector3D(1, -1, 0), { label: 'q₃ (+4 µC)' }),
          createCharge('4', -4e-6, new Vector3D(-1, -1, 0), { label: 'q₄ (-4 µC)' }),
        ]);
        break;
      case 'monopolo':
        this.charges.set([
          createCharge('1', 6e-6, new Vector3D(0, 0, 0), { label: 'q₁ (+6 µC)' }),
        ]);
        break;
      case 'linea':
        this.charges.set([
          createCharge('1', 3e-6, new Vector3D(-1.5, 0, 0), { label: 'q₁ (+3 µC)' }),
          createCharge('2', -3e-6, new Vector3D(-0.5, 0, 0), { label: 'q₂ (-3 µC)' }),
          createCharge('3', 3e-6, new Vector3D(0.5, 0, 0), { label: 'q₃ (+3 µC)' }),
          createCharge('4', -3e-6, new Vector3D(1.5, 0, 0), { label: 'q₄ (-3 µC)' }),
        ]);
        break;
    }
    this.selectedChargeId.set('1');
  }
}
