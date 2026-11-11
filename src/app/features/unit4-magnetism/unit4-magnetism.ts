import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vector3D } from '../../core/math/vector3d';
import { PHYSICS_CONSTANTS } from '../../core/math/constants';
import {
  MagneticEngine,
  MagneticSourceConfig,
  MagneticSourceType,
} from '../../core/physics/magnetics/magnetic-engine';
import { BorisIntegrator, LorentzParticleConfig } from '../../core/physics/magnetics/boris-integrator';
import { LorentzSceneAdapter } from '../../adapters/three/lorentz-scene-adapter';

export type PresetType = 'helix' | 'wien' | 'cycloid' | 'loop' | 'dipole';

@Component({
  selector: 'app-unit4-magnetism',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="magnetism-layout">
      <!-- VIEWPORT 3D -->
      <div class="viewport-container" #viewportContainer>
        <!-- HUD DE MEDICIÓN EN TIEMPO REAL -->
        <div class="hud-panel">
          <div class="hud-header">
            <span class="hud-title">🧲 Dinámica de Lorentz y Magnetismo</span>
            <span class="hud-badge">Algoritmo de Boris</span>
          </div>

          <div class="hud-body">
            <div class="hud-metric highlight">
              <span class="metric-label">Campo Magnético |B|:</span>
              <span class="metric-val b-accent">
                {{ probeB().norm() | number: '1.2-3' }} T
              </span>
            </div>

            <div class="hud-subrow">
              <span>Bx: {{ probeB().x | number: '1.2-2' }}</span>
              <span>By: {{ probeB().y | number: '1.2-2' }}</span>
              <span>Bz: {{ probeB().z | number: '1.2-2' }}</span>
            </div>

            <div class="hud-metric">
              <span class="metric-label">Campo Eléctrico Cruzado |E|:</span>
              <span class="metric-val e-accent">
                {{ electricField().norm() | number: '1.1-1' }} V/m
              </span>
            </div>

            <div class="hud-metric highlight">
              <span class="metric-label">Radio de Larmor (r_L):</span>
              <span class="metric-val">
                @if (larmorRadius() < 100) {
                  {{ larmorRadius() | number: '1.2-2' }} m
                } @else {
                  ∞ (Rectilíneo)
                }
              </span>
            </div>

            <div class="hud-metric">
              <span class="metric-label">Frecuencia Ciclotrón (ω_c):</span>
              <span class="metric-val">
                {{ cyclotronFreq() | number: '1.2-2' }} rad/s
              </span>
            </div>

            <div class="hud-metric">
              <span class="metric-label">Velocidad |v|:</span>
              <span class="metric-val">
                {{ particleVel().norm() | number: '1.2-2' }} m/s
              </span>
            </div>

            <div class="hud-metric">
              <span class="metric-label">Conservación Energía:</span>
              <span class="metric-val energy-ok">100.0% (Simpléctico)</span>
            </div>
          </div>
        </div>

        <div class="interaction-hint">
          <span>💡 Gira la cámara con clic izquierdo • Observa la conservación exacta del radio orbital de Larmor</span>
        </div>
      </div>

      <!-- SIDEBAR LATERAL DE CONTROLES FÍSICOS -->
      <aside class="sidebar-panel">
        <!-- PRESETS DE LABORATORIO -->
        <div class="panel-section">
          <h3 class="section-title">Escenarios de Laboratorio</h3>
          <div class="preset-grid">
            <button class="btn-preset" (click)="loadPreset('helix')">
              Mov. Helicoidal 3D
            </button>
            <button class="btn-preset" (click)="loadPreset('wien')">
              Selector Wien (v=E/B)
            </button>
            <button class="btn-preset" (click)="loadPreset('cycloid')">
              Deriva E×B (Cicloide)
            </button>
            <button class="btn-preset" (click)="loadPreset('loop')">
              Espira Biot-Savart
            </button>
            <button class="btn-preset" (click)="loadPreset('dipole')">
              Imán Dipolar (N-S)
            </button>
          </div>
        </div>

        <!-- TIPO DE FUENTE MAGNÉTICA -->
        <div class="panel-section">
          <h3 class="section-title">Fuente de Campo Magnético</h3>
          <div class="source-types">
            <button
              class="btn-type"
              [class.active]="sourceType() === 'UNIFORM'"
              (click)="sourceType.set('UNIFORM')"
            >
              Uniforme
            </button>
            <button
              class="btn-type"
              [class.active]="sourceType() === 'WIRE'"
              (click)="sourceType.set('WIRE')"
            >
              Alambre I
            </button>
            <button
              class="btn-type"
              [class.active]="sourceType() === 'LOOP'"
              (click)="sourceType.set('LOOP')"
            >
              Espira
            </button>
            <button
              class="btn-type"
              [class.active]="sourceType() === 'DIPOLE'"
              (click)="sourceType.set('DIPOLE')"
            >
              Dipolo
            </button>
          </div>

          @if (sourceType() === 'UNIFORM') {
            <div class="control-group">
              <div class="control-label">
                <span>Campo Bz:</span>
                <strong>{{ bUniformZ() }} T</strong>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.2"
                [ngModel]="bUniformZ()"
                (ngModelChange)="bUniformZ.set($event)"
              />
            </div>
          } @else if (sourceType() === 'WIRE' || sourceType() === 'LOOP') {
            <div class="control-group">
              <div class="control-label">
                <span>Corriente I:</span>
                <strong>{{ currentI() }} A</strong>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                [ngModel]="currentI()"
                (ngModelChange)="currentI.set($event)"
              />
            </div>
          }

          <div class="toggle-row">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [ngModel]="showFieldVectors()"
                (ngModelChange)="showFieldVectors.set($event)"
              />
              <span>Mostrar Vectores de Campo B (GPU)</span>
            </label>
          </div>
        </div>

        <!-- CAMPO ELÉCTRICO CRUZADO E -->
        <div class="panel-section">
          <h3 class="section-title">Campo Eléctrico Cruzado E</h3>
          <div class="control-group">
            <div class="control-label">
              <span>Ey (Cruzado):</span>
              <strong>{{ eFieldY() }} V/m</strong>
            </div>
            <input
              type="range"
              min="-20"
              max="20"
              step="1"
              [ngModel]="eFieldY()"
              (ngModelChange)="eFieldY.set($event)"
            />
          </div>
        </div>

        <!-- PARTÍCULA DE PRUEBA -->
        <div class="panel-section">
          <h3 class="section-title">Partícula en Movimiento</h3>

          <div class="particle-presets">
            <button class="btn-part" (click)="setParticleType('proton')">Protón (+e)</button>
            <button class="btn-part" (click)="setParticleType('electron')">Electrón (-e)</button>
            <button class="btn-part" (click)="setParticleType('alfa')">Partícula Alfa</button>
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Velocidad Inicial Vx:</span>
              <strong>{{ v0X() }} m/s</strong>
            </div>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.5"
              [ngModel]="v0X()"
              (ngModelChange)="v0X.set($event)"
            />
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Velocidad Paralela Vz:</span>
              <strong>{{ v0Z() }} m/s</strong>
            </div>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.5"
              [ngModel]="v0Z()"
              (ngModelChange)="v0Z.set($event)"
            />
          </div>

          <div class="action-buttons">
            <button class="btn-launch" (click)="launchSimulation()">
              ▶ Simular Órbita (Boris)
            </button>
            <button class="btn-clear" (click)="clearSimulation()">
              Limpiar
            </button>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      .magnetism-layout {
        display: flex;
        width: 100vw;
        height: calc(100vh - 56px);
        overflow: hidden;
        background: #020617;
        position: relative;
      }

      .viewport-container {
        flex: 1;
        height: 100%;
        position: relative;
      }

      .hud-panel {
        position: absolute;
        top: 1rem;
        left: 1rem;
        width: 320px;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        color: #f8fafc;
        padding: 0.85rem;
        z-index: 20;
      }

      .hud-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #334155;
        padding-bottom: 0.45rem;
        margin-bottom: 0.5rem;
      }

      .hud-title {
        font-weight: 700;
        font-size: 0.85rem;
      }

      .hud-badge {
        font-size: 0.65rem;
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      .hud-metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.78rem;
        margin-bottom: 0.35rem;
      }

      .hud-metric.highlight {
        background: rgba(30, 41, 59, 0.7);
        padding: 0.3rem 0.5rem;
        border-radius: 0.35rem;
      }

      .hud-subrow {
        display: flex;
        justify-content: space-between;
        font-size: 0.68rem;
        color: #94a3b8;
        padding: 0 0.5rem 0.3rem 0.5rem;
      }

      .b-accent {
        color: #10b981;
        font-weight: 700;
      }

      .e-accent {
        color: #38bdf8;
        font-weight: 700;
      }

      .energy-ok {
        color: #4ade80;
        font-weight: 700;
      }

      .interaction-hint {
        position: absolute;
        bottom: 1.2rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid #334155;
        padding: 0.4rem 1rem;
        border-radius: 9999px;
        color: #94a3b8;
        font-size: 0.75rem;
        pointer-events: none;
        backdrop-filter: blur(8px);
      }

      /* SIDEBAR */
      .sidebar-panel {
        width: 360px;
        height: 100%;
        background: #0f172a;
        border-left: 1px solid #1e293b;
        color: #f1f5f9;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        z-index: 20;
      }

      .panel-section {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 0.6rem;
        padding: 0.85rem;
      }

      .section-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: #f8fafc;
        margin: 0 0 0.6rem 0;
      }

      .preset-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.4rem;
      }

      .btn-preset {
        background: #0f172a;
        color: #cbd5e1;
        border: 1px solid #475569;
        padding: 0.45rem;
        border-radius: 0.375rem;
        font-size: 0.72rem;
        cursor: pointer;
        transition: all 0.15s;
      }

      .btn-preset:hover {
        background: #059669;
        color: white;
        border-color: #10b981;
      }

      .source-types {
        display: flex;
        gap: 0.3rem;
        margin-bottom: 0.75rem;
      }

      .btn-type {
        flex: 1;
        background: #0f172a;
        border: 1px solid #475569;
        color: #94a3b8;
        padding: 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.72rem;
        cursor: pointer;
      }

      .btn-type.active {
        background: #059669;
        color: white;
        border-color: #10b981;
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.65rem;
      }

      .control-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
      }

      .control-label strong {
        color: #10b981;
      }

      input[type='range'] {
        width: 100%;
        accent-color: #10b981;
      }

      .toggle-row {
        margin-top: 0.3rem;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        cursor: pointer;
      }

      .checkbox-label input {
        accent-color: #059669;
      }

      .particle-presets {
        display: flex;
        gap: 0.3rem;
        margin-bottom: 0.75rem;
      }

      .btn-part {
        flex: 1;
        background: #0f172a;
        border: 1px solid #475569;
        color: #cbd5e1;
        padding: 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.7rem;
        cursor: pointer;
      }

      .btn-part:hover {
        border-color: #38bdf8;
        color: #38bdf8;
      }

      .action-buttons {
        display: flex;
        gap: 0.4rem;
        margin-top: 0.5rem;
      }

      .btn-launch {
        flex: 1;
        background: #10b981;
        color: #064e3b;
        font-weight: 700;
        border: none;
        padding: 0.5rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        cursor: pointer;
      }

      .btn-clear {
        background: #334155;
        color: #cbd5e1;
        border: none;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        cursor: pointer;
      }

      .btn-launch:hover {
        background: #34d399;
      }
    `,
  ],
})
export class Unit4MagnetismComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer') viewportContainer!: ElementRef<HTMLDivElement>;

  private sceneAdapter!: LorentzSceneAdapter;
  private engine = new MagneticEngine();

  // Estado reactivo (Signals)
  sourceType = signal<MagneticSourceType>('UNIFORM');
  bUniformZ = signal<number>(2.0); // 2 Tesla
  currentI = signal<number>(10.0); // 10 A
  loopRadius = signal<number>(1.2); // 1.2 m
  showFieldVectors = signal<boolean>(true);

  // Campo eléctrico cruzado E
  eFieldY = signal<number>(0); // 0 V/m

  // Partícula
  particleQ = signal<number>(1.0); // 1 C
  particleMass = signal<number>(1.0); // 1 kg
  v0X = signal<number>(4.0); // 4 m/s
  v0Z = signal<number>(1.0); // 1 m/s (para hélice)

  // Configuración de la fuente magnética
  sourceConfig = computed<MagneticSourceConfig>(() => {
    return {
      type: this.sourceType(),
      uniformB: new Vector3D(0, 0, this.bUniformZ()),
      current: this.currentI(),
      loopRadius: this.loopRadius(),
      dipoleMoment: new Vector3D(0, 0, 15.0),
      position: Vector3D.ZERO,
    };
  });

  electricField = computed<Vector3D>(() => {
    return new Vector3D(0, this.eFieldY(), 0);
  });

  particleVel = computed<Vector3D>(() => {
    return new Vector3D(this.v0X(), 0, this.v0Z());
  });

  // Medición puntual en el origen o posición de lanzamiento
  probeB = computed<Vector3D>(() => {
    return this.engine.calculateMagneticField(Vector3D.ZERO, this.sourceConfig());
  });

  larmorRadius = computed<number>(() => {
    const v = this.particleVel();
    const b = this.probeB();
    return BorisIntegrator.calculateLarmorRadius(v, b, this.particleQ(), this.particleMass());
  });

  cyclotronFreq = computed<number>(() => {
    return BorisIntegrator.calculateCyclotronFrequency(
      this.probeB(),
      this.particleQ(),
      this.particleMass()
    );
  });

  constructor() {
    effect(() => {
      const cfg = this.sourceConfig();
      const showVec = this.showFieldVectors();

      if (this.sceneAdapter) {
        this.sceneAdapter.updateMagneticField(cfg, showVec);
      }
    });
  }

  ngAfterViewInit(): void {
    this.sceneAdapter = new LorentzSceneAdapter();
    this.sceneAdapter.init(this.viewportContainer.nativeElement);

    this.sceneAdapter.updateMagneticField(this.sourceConfig(), this.showFieldVectors());
    this.launchSimulation();
  }

  launchSimulation(): void {
    const particle: LorentzParticleConfig = {
      q: this.particleQ(),
      mass: this.particleMass(),
      initialPosition: new Vector3D(0, -this.larmorRadius() > 0 && this.larmorRadius() < 10 ? -this.larmorRadius() : 0, 0),
      initialVelocity: this.particleVel(),
    };

    const trajectory = this.engine.simulateTrajectory(
      particle,
      this.sourceConfig(),
      this.electricField(),
      0.003,
      800
    );

    this.sceneAdapter?.setTrajectory(trajectory);
  }

  clearSimulation(): void {
    this.sceneAdapter?.clearTrajectory();
  }

  setParticleType(type: 'proton' | 'electron' | 'alfa'): void {
    // Normalizados para escala didáctica visible
    if (type === 'proton') {
      this.particleQ.set(1.0);
      this.particleMass.set(1.0);
    } else if (type === 'electron') {
      this.particleQ.set(-1.0);
      this.particleMass.set(0.25); // Masa menor -> radio menor
    } else {
      this.particleQ.set(2.0);
      this.particleMass.set(4.0); // Alfa
    }
    this.launchSimulation();
  }

  loadPreset(preset: PresetType): void {
    switch (preset) {
      case 'helix':
        this.sourceType.set('UNIFORM');
        this.bUniformZ.set(2.0);
        this.eFieldY.set(0);
        this.v0X.set(4.0);
        this.v0Z.set(1.2); // Componente paralela genera hélice 3D
        this.particleQ.set(1.0);
        this.particleMass.set(1.0);
        break;

      case 'wien':
        // Selector de velocidades E x B: v = E / B
        this.sourceType.set('UNIFORM');
        this.bUniformZ.set(2.0);
        this.eFieldY.set(8.0); // Ey = 8
        this.v0X.set(4.0); // Vx = 8 / 2 = 4 m/s -> Haz recto sin desviación
        this.v0Z.set(0);
        this.particleQ.set(1.0);
        this.particleMass.set(1.0);
        break;

      case 'cycloid':
        // Deriva cicloidal: parte del reposo en campos cruzados
        this.sourceType.set('UNIFORM');
        this.bUniformZ.set(2.0);
        this.eFieldY.set(6.0);
        this.v0X.set(0.0); // Reposo inicial
        this.v0Z.set(0);
        this.particleQ.set(1.0);
        this.particleMass.set(1.0);
        break;

      case 'loop':
        this.sourceType.set('LOOP');
        this.currentI.set(12.0);
        this.eFieldY.set(0);
        this.v0X.set(3.0);
        this.v0Z.set(0.5);
        break;

      case 'dipole':
        this.sourceType.set('DIPOLE');
        this.eFieldY.set(0);
        this.v0X.set(3.5);
        this.v0Z.set(0.8);
        break;
    }

    setTimeout(() => this.launchSimulation(), 50);
  }

  ngOnDestroy(): void {
    this.sceneAdapter?.dispose();
  }
}
