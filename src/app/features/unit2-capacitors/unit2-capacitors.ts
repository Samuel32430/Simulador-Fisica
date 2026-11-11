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
import {
  CapacitorEngine,
  CapacitorInput,
  CapacitorCalculationResult,
} from '../../core/physics/capacitors/capacitor-engine';
import {
  DIELECTRIC_MATERIALS,
  DielectricMaterial,
} from '../../core/physics/capacitors/dielectric-materials';
import { CapacitorSceneAdapter } from '../../adapters/three/capacitor-scene-adapter';

@Component({
  selector: 'app-unit2-capacitors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="capacitors-layout">
      <!-- VIEWPORT 3D -->
      <div class="viewport-container" #viewportContainer>
        <!-- HUD DE MEDICIÓN EN TIEMPO REAL -->
        <div class="hud-panel">
          <div class="hud-header">
            <span class="hud-title">⚡ Parámetros del Capacitor</span>
            <span class="hud-badge">En Tiempo Real</span>
          </div>

          <div class="hud-body">
            <div class="hud-metric highlight">
              <span class="metric-label">Capacitancia (C):</span>
              <span class="metric-val cap">
                {{ formatCapacitance(calcResult().capacitance) }}
              </span>
            </div>

            <div class="hud-subrow">
              <span>Ideal: {{ formatCapacitance(calcResult().capacitanceIdeal) }}</span>
              @if (includeFringing()) {
                <span class="fringe-tag">+{{ ((calcResult().fringingFactor - 1) * 100) | number: '1.1-1' }}% borde</span>
              }
            </div>

            <div class="hud-metric">
              <span class="metric-label">Carga Almacenada (Q):</span>
              <span class="metric-val">{{ formatCharge(calcResult().charge) }}</span>
            </div>

            <div class="hud-metric highlight">
              <span class="metric-label">Energía Almacenada (U):</span>
              <span class="metric-val energy">
                {{ formatEnergy(calcResult().storedEnergy) }}
              </span>
            </div>

            <div class="hud-metric">
              <span class="metric-label">Campo Eléctrico (E):</span>
              <span class="metric-val">
                {{ calcResult().electricField / 1000 | number: '1.2-2' }} kV/m
              </span>
            </div>

            <div class="hud-metric">
              <span class="metric-label">Densidad de Energía (u_E):</span>
              <span class="metric-val">
                {{ calcResult().energyDensity | number: '1.2-3' }} J/m³
              </span>
            </div>

            <!-- SEMÁFORO DE RUPTURA DIELÉCTRICA -->
            <div
              class="breakdown-box"
              [class.safe]="calcResult().breakdownStatus === 'SEGURO'"
              [class.warning]="calcResult().breakdownStatus === 'PRECAUCION'"
              [class.danger]="
                calcResult().breakdownStatus === 'RUPTURA_AIRE' ||
                calcResult().breakdownStatus === 'RUPTURA_DIELECTRICO' ||
                calcResult().breakdownStatus === 'RUPTURA_TOTAL'
              "
            >
              <div class="breakdown-header">
                <span class="dot"></span>
                <strong>{{ getBreakdownLabel(calcResult().breakdownStatus) }}</strong>
              </div>
              <div class="stress-bar-container">
                <div
                  class="stress-bar"
                  [style.width.%]="Math.min(calcResult().breakdownStressPercent, 100)"
                ></div>
              </div>
              <span class="stress-text">
                Esfuerzo dieléctrico: {{ calcResult().breakdownStressPercent | number: '1.0-0' }}%
              </span>
            </div>
          </div>
        </div>

        <div class="interaction-hint">
          <span>💡 Gira la cámara con clic izquierdo • Ajusta los sliders para observar el movimiento 3D de las placas</span>
        </div>
      </div>

      <!-- PANEL LATERAL DE CONTROLES FÍSICOS -->
      <aside class="sidebar-panel">
        <!-- PRESETS DIDÁCTICOS -->
        <div class="panel-section">
          <h3 class="section-title">Escenarios Didácticos</h3>
          <div class="preset-grid">
            <button class="btn-preset" (click)="loadPreset('aire')">
              Capacitor en Aire
            </button>
            <button class="btn-preset" (click)="loadPreset('titanato')">
              Alta Energía (BaTiO₃)
            </button>
            <button class="btn-preset" (click)="loadPreset('ruptura')">
              Ruptura / Arco
            </button>
            <button class="btn-preset" (click)="loadPreset('parcial')">
              Dieléctrico al 50%
            </button>
          </div>
        </div>

        <!-- VARIABLES GEOMÉTRICAS Y ELÉCTRICAS -->
        <div class="panel-section">
          <h3 class="section-title">Variables Físicas</h3>

          <div class="control-group">
            <div class="control-label">
              <span>Área de Placas (A):</span>
              <strong>{{ areaCm2() }} cm²</strong>
            </div>
            <input
              type="range"
              min="10"
              max="250"
              step="5"
              [ngModel]="areaCm2()"
              (ngModelChange)="areaCm2.set($event)"
            />
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Separación (d):</span>
              <strong>{{ separationMm() }} mm</strong>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              [ngModel]="separationMm()"
              (ngModelChange)="separationMm.set($event)"
            />
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Voltaje Aplicado (V):</span>
              <strong>{{ voltageV() }} V</strong>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="50"
              [ngModel]="voltageV()"
              (ngModelChange)="voltageV.set($event)"
            />
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Inserción del Dieléctrico:</span>
              <strong>{{ (insertionFraction() * 100) | number: '1.0-0' }}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              [ngModel]="insertionFraction()"
              (ngModelChange)="insertionFraction.set($event)"
            />
          </div>

          <div class="toggle-row">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [ngModel]="includeFringing()"
                (ngModelChange)="includeFringing.set($event)"
              />
              <span>Efecto de Borde (Kirchhoff-Palmer)</span>
            </label>
          </div>
        </div>

        <!-- SELECTOR DE MATERIAL DIELÉCTRICO -->
        <div class="panel-section">
          <h3 class="section-title">Material Dieléctrico</h3>
          <div class="materials-list">
            @for (mat of materials; track mat.id) {
              <div
                class="material-item"
                [class.selected]="selectedMaterial().id === mat.id"
                (click)="selectedMaterial.set(mat)"
              >
                <div class="mat-color-tag" [style.background-color]="getHexColor(mat.colorHex)"></div>
                <div class="mat-info">
                  <div class="mat-name">
                    {{ mat.name }}
                    <span class="mat-kappa">κ = {{ mat.dielectricConstant }}</span>
                  </div>
                  <div class="mat-desc">{{ mat.description }}</div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- GRÁFICO 2D EN TIEMPO REAL: C vs d -->
        <div class="panel-section">
          <h3 class="section-title">Curva Teórica C vs Separación (d)</h3>
          <div class="chart-container">
            <canvas #chartCanvas width="320" height="140"></canvas>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      .capacitors-layout {
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
        border: 1px solid rgba(56, 189, 248, 0.3);
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
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        border: 1px solid rgba(56, 189, 248, 0.3);
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

      .fringe-tag {
        color: #f59e0b;
        font-weight: 600;
      }

      .metric-val.cap {
        color: #38bdf8;
        font-weight: 700;
      }

      .metric-val.energy {
        color: #4ade80;
        font-weight: 700;
      }

      .breakdown-box {
        margin-top: 0.5rem;
        padding: 0.5rem;
        border-radius: 0.4rem;
        border: 1px solid #334155;
        background: #0f172a;
      }

      .breakdown-box.safe {
        border-color: rgba(34, 197, 94, 0.4);
      }

      .breakdown-box.safe .dot {
        background: #22c55e;
      }

      .breakdown-box.warning {
        border-color: rgba(245, 158, 11, 0.6);
        background: rgba(245, 158, 11, 0.1);
      }

      .breakdown-box.warning .dot {
        background: #f59e0b;
      }

      .breakdown-box.danger {
        border-color: rgba(239, 68, 68, 0.8);
        background: rgba(239, 68, 68, 0.15);
      }

      .breakdown-box.danger .dot {
        background: #ef4444;
        box-shadow: 0 0 8px #ef4444;
      }

      .breakdown-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        margin-bottom: 0.3rem;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .stress-bar-container {
        width: 100%;
        height: 5px;
        background: #1e293b;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 0.25rem;
      }

      .stress-bar {
        height: 100%;
        background: linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%);
        transition: width 0.15s ease;
      }

      .stress-text {
        font-size: 0.68rem;
        color: #94a3b8;
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
        background: #0284c7;
        color: white;
        border-color: #38bdf8;
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
        color: #38bdf8;
      }

      .control-group input[type='range'] {
        width: 100%;
        accent-color: #38bdf8;
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
        accent-color: #0284c7;
      }

      .materials-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        max-height: 200px;
        overflow-y: auto;
      }

      .material-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 0.375rem;
        padding: 0.45rem 0.6rem;
        cursor: pointer;
        transition: all 0.15s;
      }

      .material-item.selected {
        border-color: #38bdf8;
        background: rgba(56, 189, 248, 0.12);
      }

      .mat-color-tag {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        flex-shrink: 0;
      }

      .mat-info {
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .mat-name {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .mat-kappa {
        color: #facc15;
        font-size: 0.7rem;
      }

      .mat-desc {
        font-size: 0.65rem;
        color: #94a3b8;
      }

      .chart-container {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 0.4rem;
        padding: 0.5rem;
        display: flex;
        justify-content: center;
      }

      canvas {
        max-width: 100%;
      }
    `,
  ],
})
export class Unit2CapacitorsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer') viewportContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  readonly Math = Math;
  readonly materials = DIELECTRIC_MATERIALS;
  private engine = new CapacitorEngine();
  private sceneAdapter!: CapacitorSceneAdapter;

  // Variables físicas de entrada (Signals)
  areaCm2 = signal<number>(100); // 100 cm^2
  separationMm = signal<number>(5.0); // 5 mm
  voltageV = signal<number>(500); // 500 V
  insertionFraction = signal<number>(1.0); // 100%
  includeFringing = signal<boolean>(false);
  selectedMaterial = signal<DielectricMaterial>(DIELECTRIC_MATERIALS[1]); // Aire

  // Resultado del cálculo computacional (Computed)
  calcResult = computed<CapacitorCalculationResult>(() => {
    const input: CapacitorInput = {
      area: this.areaCm2() * 1e-4, // m^2
      separation: this.separationMm() * 1e-3, // m
      voltage: this.voltageV(),
      dielectric: this.selectedMaterial(),
      insertion: this.insertionFraction(),
      includeFringing: this.includeFringing(),
    };
    return this.engine.calculate(input);
  });

  constructor() {
    // Sincronización reactiva con la escena 3D y el canvas del gráfico
    effect(() => {
      const areaM2 = this.areaCm2() * 1e-4;
      const sepM = this.separationMm() * 1e-3;
      const v = this.voltageV();
      const diel = this.selectedMaterial();
      const ins = this.insertionFraction();
      const res = this.calcResult();

      if (this.sceneAdapter) {
        this.sceneAdapter.update({
          areaM2,
          separationM: sepM,
          voltageV: v,
          dielectric: diel,
          insertion: ins,
          calcResult: res,
        });
      }

      // Redibujar gráfico 2D
      this.drawChart();
    });
  }

  ngAfterViewInit(): void {
    this.sceneAdapter = new CapacitorSceneAdapter();
    this.sceneAdapter.init(this.viewportContainer.nativeElement);

    // Actualización inicial
    this.sceneAdapter.update({
      areaM2: this.areaCm2() * 1e-4,
      separationM: this.separationMm() * 1e-3,
      voltageV: this.voltageV(),
      dielectric: this.selectedMaterial(),
      insertion: this.insertionFraction(),
      calcResult: this.calcResult(),
    });

    this.drawChart();
  }

  formatCapacitance(cFarads: number): string {
    if (cFarads >= 1e-6) {
      return `${(cFarads * 1e6).toFixed(2)} µF`;
    } else if (cFarads >= 1e-9) {
      return `${(cFarads * 1e9).toFixed(2)} nF`;
    } else {
      return `${(cFarads * 1e12).toFixed(2)} pF`;
    }
  }

  formatCharge(qCoulombs: number): string {
    if (qCoulombs >= 1e-6) {
      return `${(qCoulombs * 1e6).toFixed(2)} µC`;
    } else if (qCoulombs >= 1e-9) {
      return `${(qCoulombs * 1e9).toFixed(2)} nC`;
    } else {
      return `${(qCoulombs * 1e12).toFixed(2)} pC`;
    }
  }

  formatEnergy(joules: number): string {
    if (joules >= 1) {
      return `${joules.toFixed(3)} J`;
    } else if (joules >= 1e-3) {
      return `${(joules * 1e3).toFixed(2)} mJ`;
    } else {
      return `${(joules * 1e6).toFixed(2)} µJ`;
    }
  }

  getBreakdownLabel(status: string): string {
    switch (status) {
      case 'SEGURO':
        return 'Operación Segura';
      case 'PRECAUCION':
        return 'Alerta: Cerca de Ruptura';
      case 'RUPTURA_AIRE':
        return '¡Ruptura Dieléctrica del Aire!';
      case 'RUPTURA_DIELECTRICO':
        return '¡Ruptura del Dieléctrico!';
      case 'RUPTURA_TOTAL':
        return '¡Arco Eléctrico / Ruptura Total!';
      default:
        return 'Normal';
    }
  }

  getHexColor(hexNumber: number): string {
    return '#' + hexNumber.toString(16).padStart(6, '0');
  }

  loadPreset(type: 'aire' | 'titanato' | 'ruptura' | 'parcial'): void {
    switch (type) {
      case 'aire':
        this.selectedMaterial.set(this.materials[1]); // Aire
        this.areaCm2.set(100);
        this.separationMm.set(5);
        this.voltageV.set(500);
        this.insertionFraction.set(1.0);
        this.includeFringing.set(false);
        break;
      case 'titanato':
        this.selectedMaterial.set(this.materials[6]); // BaTiO3 (kappa = 1200)
        this.areaCm2.set(150);
        this.separationMm.set(2);
        this.voltageV.set(1000);
        this.insertionFraction.set(1.0);
        break;
      case 'ruptura':
        this.selectedMaterial.set(this.materials[1]); // Aire
        this.areaCm2.set(80);
        this.separationMm.set(1.0); // 1 mm -> limite 3000 V
        this.voltageV.set(4000); // 4000 V -> supera rigidez
        this.insertionFraction.set(1.0);
        break;
      case 'parcial':
        this.selectedMaterial.set(this.materials[2]); // Teflon
        this.areaCm2.set(120);
        this.separationMm.set(4);
        this.voltageV.set(800);
        this.insertionFraction.set(0.5); // 50%
        break;
    }
  }

  drawChart(): void {
    if (!this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Fondo
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Generar datos C(d)
    const curve = this.engine.generateCapacitanceVsDistanceCurve(
      this.areaCm2() * 1e-4,
      this.selectedMaterial(),
      this.insertionFraction(),
      0.001,
      0.02,
      25
    );

    if (curve.length < 2) return;

    const maxC = Math.max(...curve.map((p) => p.capacitancePf));
    const padX = 35;
    const padY = 20;
    const plotW = width - padX - 10;
    const plotH = height - padY - 20;

    // Ejes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, padY);
    ctx.lineTo(padX, height - 20);
    ctx.lineTo(width - 10, height - 20);
    ctx.stroke();

    // Curva C(d)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const pt = curve[i];
      const x = padX + (i / (curve.length - 1)) * plotW;
      const y = height - 20 - (pt.capacitancePf / maxC) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Punto actual de operación
    const currentD = this.separationMm();
    const currentC = this.calcResult().capacitance * 1e12;
    const curX = padX + ((currentD - 1) / 19) * plotW;
    const curY = height - 20 - Math.min(currentC / maxC, 1) * plotH;

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Etiquetas
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('C [pF]', 5, 14);
    ctx.fillText('d [mm]', width - 35, height - 6);
  }

  ngOnDestroy(): void {
    this.sceneAdapter?.dispose();
  }
}
