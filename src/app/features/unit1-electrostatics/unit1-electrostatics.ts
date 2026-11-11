import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimulationStateService } from '../../shared/services/simulation-state.service';
import { ThreeSceneManager } from '../../adapters/three/three-scene-manager';
import { ChargeRenderer } from '../../adapters/three/charge-renderer';
import { VectorFieldRenderer } from '../../adapters/three/vector-field-renderer';
import { FieldLineRenderer } from '../../adapters/three/field-line-renderer';
import { TrajectoryRenderer } from '../../adapters/three/trajectory-renderer';
import { Vector3D } from '../../core/math/vector3d';

@Component({
  selector: 'app-unit1-electrostatics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="electrostatics-layout">
      <!-- VIEWPORT 3D -->
      <div class="viewport-container" #viewportContainer>
        <!-- HUD VIRTUAL FLOTANTE (MULTÍMETRO Y SONDA DE CAMPO) -->
        <div class="hud-probe">
          <div class="hud-header">
            <span class="hud-title">⚡ Sonda de Medición Virtual</span>
            <span class="hud-badge">Tiempo Real</span>
          </div>
          <div class="hud-body">
            <div class="hud-row">
              <span class="label">Posición Sonda (r):</span>
              <span class="value"
                >({{ probePos.x | number: '1.2-2' }},
                {{ probePos.y | number: '1.2-2' }},
                {{ probePos.z | number: '1.2-2' }}) m</span
              >
            </div>
            <div class="hud-row highlight">
              <span class="label">Magnitud Campo |E|:</span>
              <span class="value accent"
                >{{ state.probeMeasurement().fieldMagnitude | number: '1.2-2' }} N/C</span
              >
            </div>
            <div class="hud-subrow">
              <span>Ex: {{ state.probeMeasurement().field.x | number: '1.1-1' }}</span>
              <span>Ey: {{ state.probeMeasurement().field.y | number: '1.1-1' }}</span>
              <span>Ez: {{ state.probeMeasurement().field.z | number: '1.1-1' }}</span>
            </div>
            <div class="hud-row highlight">
              <span class="label">Potencial Escalar V:</span>
              <span class="value volt"
                >{{ state.probeMeasurement().potential | number: '1.2-2' }} V</span
              >
            </div>
            <div class="hud-row">
              <span class="label">Energía Total U:</span>
              <span class="value"
                >{{ state.totalSystemEnergy() | number: '1.2-4' }} J</span
              >
            </div>

            <!-- Controles de la posición de la sonda -->
            <div class="probe-sliders">
              <label>Mover Sonda X: {{ probePos.x | number: '1.1-1' }} m</label>
              <input
                type="range"
                min="-2.5"
                max="2.5"
                step="0.1"
                [(ngModel)]="probePos.x"
                (ngModelChange)="onProbePosChange()"
              />
              <label>Mover Sonda Y: {{ probePos.y | number: '1.1-1' }} m</label>
              <input
                type="range"
                min="-2.5"
                max="2.5"
                step="0.1"
                [(ngModel)]="probePos.y"
                (ngModelChange)="onProbePosChange()"
              />
            </div>
          </div>
        </div>

        <!-- INDICADOR DE INTERACCIÓN 3D -->
        <div class="interaction-hint">
          <span>💡 Arrastra las cargas con el ratón sobre el plano 3D • Gira la cámara con clic derecho / rotar</span>
        </div>
      </div>

      <!-- SIDEBAR DE CONTROLES FÍSICOS -->
      <aside class="sidebar-panel">
        <!-- SECCIÓN PRESETS -->
        <div class="panel-section">
          <h3 class="section-title">Escenarios Didácticos (Presets)</h3>
          <div class="preset-buttons">
            <button class="btn-preset" (click)="state.loadPreset('dipolo')">
              Dipolo (+ -)
            </button>
            <button class="btn-preset" (click)="state.loadPreset('cuadripolo')">
              Cuadripolo
            </button>
            <button class="btn-preset" (click)="state.loadPreset('monopolo')">
              Monopolo (+)
            </button>
            <button class="btn-preset" (click)="state.loadPreset('linea')">
              Línea de 4
            </button>
          </div>
        </div>

        <!-- SECCIÓN AÑADIR CARGAS -->
        <div class="panel-section">
          <h3 class="section-title">
            Distribución de Cargas ({{ state.charges().length }}/10)
          </h3>
          <div class="add-buttons">
            <button class="btn-add pos" (click)="state.addCharge(+5)">
              + Añadir +5 µC
            </button>
            <button class="btn-add neg" (click)="state.addCharge(-5)">
              - Añadir -5 µC
            </button>
          </div>

          <!-- LISTA DE CARGAS -->
          <div class="charge-list">
            @for (ch of state.charges(); track ch.id) {
              <div
                class="charge-item"
                [class.selected]="ch.id === state.selectedChargeId()"
                (click)="state.selectedChargeId.set(ch.id)"
              >
                <div class="charge-header">
                  <span
                    class="charge-dot"
                    [class.pos]="ch.q > 0"
                    [class.neg]="ch.q < 0"
                  ></span>
                  <span class="charge-name">{{ ch.label }}</span>
                  <button
                    class="btn-delete"
                    (click)="state.removeCharge(ch.id); $event.stopPropagation()"
                    title="Eliminar carga"
                  >
                    ✕
                  </button>
                </div>

                @if (ch.id === state.selectedChargeId()) {
                  <div class="charge-details" (click)="$event.stopPropagation()">
                    <div class="slider-group">
                      <label>
                        Magnitud q:
                        <strong
                          >{{ ch.q * 1e6 | number: '1.1-1' }} µC</strong
                        >
                      </label>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="0.5"
                        [ngModel]="ch.q * 1e6"
                        (ngModelChange)="onChargeMagnitudeChange(ch.id, $event)"
                      />
                    </div>
                    <div class="coords-row">
                      <span>Pos: ({{ ch.position.x | number: '1.1-1' }}, {{ ch.position.y | number: '1.1-1' }}) m</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- SECCIÓN VISUALIZACIÓN -->
        <div class="panel-section">
          <h3 class="section-title">Visualización de Campos</h3>
          <div class="toggle-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [ngModel]="state.showFieldVectors()"
                (ngModelChange)="state.showFieldVectors.set($event)"
              />
              <span>Vectores de Campo Eléctrico E (GPU)</span>
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                [ngModel]="state.showFieldLines()"
                (ngModelChange)="state.showFieldLines.set($event)"
              />
              <span>Líneas de Flujo Continuas (RK4)</span>
            </label>
          </div>

          <div class="density-group">
            <label>Densidad de la malla vectorial:</label>
            <div class="density-radios">
              <button
                class="btn-density"
                [class.active]="state.vectorDensity() === 'baja'"
                (click)="state.vectorDensity.set('baja')"
              >
                Baja
              </button>
              <button
                class="btn-density"
                [class.active]="state.vectorDensity() === 'media'"
                (click)="state.vectorDensity.set('media')"
              >
                Media
              </button>
              <button
                class="btn-density"
                [class.active]="state.vectorDensity() === 'alta'"
                (click)="state.vectorDensity.set('alta')"
              >
                Alta
              </button>
            </div>
          </div>
        </div>

        <!-- SECCIÓN LANZADOR DE PARTÍCULA DE PRUEBA -->
        <div class="panel-section">
          <h3 class="section-title">Simulador de Trayectoria (Dinámica)</h3>
          <p class="section-desc">
            Lanza una partícula libre bajo la aceleración electrostática pura
            F = qE = ma.
          </p>

          <div class="trajectory-controls">
            <div class="field-row">
              <label>Carga partícula:</label>
              <select [(ngModel)]="testParticleQ">
                <option [value]="-1e-6">Electrón / Atractiva (-1 µC)</option>
                <option [value]="1e-6">Protón / Repulsiva (+1 µC)</option>
              </select>
            </div>
            <div class="action-buttons">
              <button class="btn-launch" (click)="launchTestParticle()">
                ▶ Lanzar Partícula
              </button>
              <button class="btn-clear" (click)="clearTrajectory()">
                Limpiar Estela
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      .electrostatics-layout {
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

      .hud-probe {
        position: absolute;
        top: 1rem;
        left: 1rem;
        width: 320px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        color: #f8fafc;
        padding: 0.85rem;
        pointer-events: auto;
        z-index: 20;
      }

      .hud-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #334155;
        padding-bottom: 0.5rem;
        margin-bottom: 0.6rem;
      }

      .hud-title {
        font-weight: 700;
        font-size: 0.85rem;
        color: #e2e8f0;
      }

      .hud-badge {
        font-size: 0.65rem;
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        border: 1px solid rgba(34, 197, 94, 0.4);
      }

      .hud-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.78rem;
        margin-bottom: 0.35rem;
      }

      .hud-row.highlight {
        background: rgba(30, 41, 59, 0.6);
        padding: 0.25rem 0.4rem;
        border-radius: 0.35rem;
      }

      .hud-subrow {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        color: #94a3b8;
        padding-left: 0.5rem;
        margin-bottom: 0.4rem;
      }

      .value.accent {
        color: #38bdf8;
        font-weight: 700;
      }

      .value.volt {
        color: #facc15;
        font-weight: 700;
      }

      .probe-sliders {
        margin-top: 0.5rem;
        border-top: 1px dashed #334155;
        padding-top: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .probe-sliders label {
        font-size: 0.7rem;
        color: #94a3b8;
      }

      .probe-sliders input[type='range'] {
        width: 100%;
        accent-color: #38bdf8;
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
        gap: 1.2rem;
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
        letter-spacing: -0.01em;
      }

      .section-desc {
        font-size: 0.72rem;
        color: #94a3b8;
        margin-bottom: 0.6rem;
      }

      .preset-buttons {
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
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.15s;
      }

      .btn-preset:hover {
        background: #0284c7;
        color: white;
        border-color: #38bdf8;
      }

      .add-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.4rem;
        margin-bottom: 0.75rem;
      }

      .btn-add {
        border: none;
        padding: 0.5rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }

      .btn-add.pos {
        background: #ef4444;
        color: white;
      }

      .btn-add.neg {
        background: #3b82f6;
        color: white;
      }

      .btn-add:hover {
        opacity: 0.9;
      }

      .charge-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        max-height: 220px;
        overflow-y: auto;
      }

      .charge-item {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 0.375rem;
        padding: 0.45rem 0.6rem;
        cursor: pointer;
        transition: border-color 0.15s;
      }

      .charge-item.selected {
        border-color: #facc15;
        background: rgba(30, 41, 59, 0.8);
      }

      .charge-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .charge-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .charge-dot.pos {
        background: #ef4444;
      }

      .charge-dot.neg {
        background: #3b82f6;
      }

      .charge-name {
        flex: 1;
        font-size: 0.75rem;
      }

      .btn-delete {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 0.85rem;
        cursor: pointer;
      }

      .btn-delete:hover {
        color: #ef4444;
      }

      .charge-details {
        margin-top: 0.5rem;
        padding-top: 0.4rem;
        border-top: 1px dashed #334155;
      }

      .slider-group {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .slider-group label {
        font-size: 0.7rem;
        color: #cbd5e1;
      }

      .slider-group input {
        width: 100%;
        accent-color: #facc15;
      }

      .coords-row {
        font-size: 0.68rem;
        color: #94a3b8;
        margin-top: 0.2rem;
      }

      .toggle-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
      }

      .checkbox-label input {
        accent-color: #0284c7;
      }

      .density-group label {
        display: block;
        font-size: 0.72rem;
        color: #94a3b8;
        margin-bottom: 0.35rem;
      }

      .density-radios {
        display: flex;
        gap: 0.3rem;
      }

      .btn-density {
        flex: 1;
        background: #0f172a;
        border: 1px solid #475569;
        color: #94a3b8;
        padding: 0.3rem;
        border-radius: 0.25rem;
        font-size: 0.7rem;
        cursor: pointer;
      }

      .btn-density.active {
        background: #0284c7;
        color: white;
        border-color: #38bdf8;
      }

      .trajectory-controls {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .field-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.72rem;
      }

      .field-row select {
        background: #0f172a;
        border: 1px solid #475569;
        color: #f8fafc;
        padding: 0.3rem;
        border-radius: 0.3rem;
        font-size: 0.72rem;
      }

      .action-buttons {
        display: flex;
        gap: 0.4rem;
        margin-top: 0.3rem;
      }

      .btn-launch {
        flex: 1;
        background: #f59e0b;
        color: #0f172a;
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
        background: #fbbf24;
      }

      .btn-clear:hover {
        background: #475569;
      }
    `,
  ],
})
export class Unit1ElectrostaticsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer') viewportContainer!: ElementRef<HTMLDivElement>;

  readonly state = inject(SimulationStateService);

  private sceneManager!: ThreeSceneManager;
  private chargeRenderer!: ChargeRenderer;
  private vectorFieldRenderer!: VectorFieldRenderer;
  private fieldLineRenderer!: FieldLineRenderer;
  private trajectoryRenderer!: TrajectoryRenderer;

  probePos = { x: 0, y: 0.8, z: 0 };
  testParticleQ = -1e-6;

  constructor() {
    // Sincronización reactiva con Angular Signals
    effect(() => {
      const charges = this.state.charges();
      const selectedId = this.state.selectedChargeId();
      const showVectors = this.state.showFieldVectors();
      const showLines = this.state.showFieldLines();
      const density = this.state.vectorDensity();

      if (this.sceneManager) {
        this.chargeRenderer?.update(charges, selectedId);
        this.vectorFieldRenderer?.rebuildGrid(density);
        this.vectorFieldRenderer?.update(charges, showVectors);
        this.fieldLineRenderer?.update(charges, showLines);
      }
    });
  }

  ngAfterViewInit(): void {
    this.sceneManager = new ThreeSceneManager();
    this.sceneManager.init(this.viewportContainer.nativeElement, {
      onChargeSelected: (id) => {
        this.state.selectedChargeId.set(id);
      },
      onChargeMoved: (id, newPos) => {
        this.state.updateCharge(id, { position: newPos });
      },
    });

    if (!this.sceneManager.renderer) return;

    this.chargeRenderer = new ChargeRenderer(this.sceneManager);
    this.vectorFieldRenderer = new VectorFieldRenderer(this.sceneManager);
    this.fieldLineRenderer = new FieldLineRenderer(this.sceneManager);
    this.trajectoryRenderer = new TrajectoryRenderer(this.sceneManager);

    // Render inicial
    const charges = this.state.charges();
    this.chargeRenderer.update(charges, this.state.selectedChargeId());
    this.vectorFieldRenderer.update(charges, this.state.showFieldVectors());
    this.fieldLineRenderer.update(charges, this.state.showFieldLines());
  }

  onProbePosChange(): void {
    this.state.setProbePosition(
      new Vector3D(this.probePos.x, this.probePos.y, this.probePos.z)
    );
  }

  onChargeMagnitudeChange(id: string, microCoulombs: number): void {
    const sign = microCoulombs >= 0 ? '+' : '';
    this.state.updateCharge(id, {
      q: microCoulombs * 1e-6,
      label: `q${id} (${sign}${microCoulombs.toFixed(1)} µC)`,
    });
  }

  launchTestParticle(): void {
    const start = new Vector3D(-2.5, 1.2, 0);
    const v0 = new Vector3D(1.2, -0.4, 0);
    this.trajectoryRenderer.launch(
      start,
      v0,
      Number(this.testParticleQ),
      this.state.charges()
    );
  }

  clearTrajectory(): void {
    this.trajectoryRenderer.clear();
  }

  ngOnDestroy(): void {
    this.chargeRenderer?.dispose();
    this.vectorFieldRenderer?.dispose();
    this.fieldLineRenderer?.dispose();
    this.trajectoryRenderer?.dispose();
    this.sceneManager?.dispose();
  }
}
