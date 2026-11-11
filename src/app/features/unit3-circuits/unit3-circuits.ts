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
import { OhmEngine, OhmCalculationResult } from '../../core/physics/circuits/ohm-engine';
import { MnaCircuitSolver } from '../../core/physics/circuits/mna-solver';
import { CircuitBranch, CircuitSolution } from '../../core/physics/circuits/circuit-types';

export type CircuitTopology = 'serie' | 'paralelo' | 'mixto' | 'wheatstone';

@Component({
  selector: 'app-unit3-circuits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="circuits-layout">
      <!-- ÁREA PRINCIPAL: CANVASES DE SIMULACIÓN Y GRÁFICAS -->
      <div class="main-viewport">
        <!-- BARRA SUPERIOR DE MODOS -->
        <div class="sub-nav">
          <button
            class="mode-btn"
            [class.active]="activeMode() === 'ohm'"
            (click)="activeMode.set('ohm')"
          >
            ⚡ Ley de Ohm y Velocidad de Deriva
          </button>
          <button
            class="mode-btn"
            [class.active]="activeMode() === 'circuits'"
            (click)="activeMode.set('circuits')"
          >
            🔌 Simulador de Redes (MNA Solver)
          </button>
        </div>

        @if (activeMode() === 'ohm') {
          <!-- MODO 1: LEY DE OHM INTERACTIVA -->
          <div class="ohm-view">
            <!-- CANVAS DE ANIMACIÓN DE FLUJO DE ELECTRONES -->
            <div class="canvas-card">
              <div class="card-header">
                <span class="card-title">Circuito Físico y Flujo de Electrones</span>
                <span class="badge live">Animación v_d ∝ I</span>
              </div>
              <canvas #ohmCanvas width="520" height="260" class="sim-canvas"></canvas>
            </div>

            <!-- GRÁFICA V vs I EN TIEMPO REAL -->
            <div class="canvas-card">
              <div class="card-header">
                <span class="card-title">Gráfica Característica Lineal V vs I</span>
                <span class="badge slope">Pendiente m = R = {{ ohmR() }} Ω</span>
              </div>
              <canvas #viGraphCanvas width="520" height="220" class="sim-canvas"></canvas>
            </div>
          </div>
        } @else {
          <!-- MODO 2: REDES DE CIRCUITOS (SERIE, PARALELO, MIXTO, WHEATSTONE) -->
          <div class="circuits-view">
            <div class="schematic-card">
              <div class="card-header">
                <div class="topo-selector">
                  <span class="card-title">Topología:</span>
                  <button
                    class="btn-topo"
                    [class.active]="selectedTopology() === 'serie'"
                    (click)="setTopology('serie')"
                  >
                    Serie
                  </button>
                  <button
                    class="btn-topo"
                    [class.active]="selectedTopology() === 'paralelo'"
                    (click)="setTopology('paralelo')"
                  >
                    Paralelo
                  </button>
                  <button
                    class="btn-topo"
                    [class.active]="selectedTopology() === 'mixto'"
                    (click)="setTopology('mixto')"
                  >
                    Mixto
                  </button>
                  <button
                    class="btn-topo"
                    [class.active]="selectedTopology() === 'wheatstone'"
                    (click)="setTopology('wheatstone')"
                  >
                    Puente Wheatstone
                  </button>
                </div>

                <button
                  class="btn-switch"
                  [class.closed]="!isSwitchOpen()"
                  (click)="isSwitchOpen.set(!isSwitchOpen())"
                >
                  Interruptor: {{ isSwitchOpen() ? 'ABIERTO (0A)' : 'CERRADO (ON)' }}
                </button>
              </div>

              <!-- ESQUEMÁTICO DEL CIRCUITO -->
              <canvas #circuitCanvas width="560" height="270" class="sim-canvas"></canvas>
            </div>

            <!-- TABLA DE RESULTADOS MNA -->
            <div class="results-table-card">
              <div class="card-header">
                <span class="card-title">Análisis Nodal Modificado (MNA SPICE Solver)</span>
                @if (mnaSolution().equivalentResistance) {
                  <span class="badge req">
                    R_eq = {{ mnaSolution().equivalentResistance | number: '1.2-2' }} Ω
                  </span>
                }
              </div>

              <div class="table-scroll">
                <table class="mna-table">
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Caída V</th>
                      <th>Corriente I</th>
                      <th>Potencia P</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of mnaSolution().branchResults; track r.branchId) {
                      <tr>
                        <td><strong>{{ r.label }}</strong></td>
                        <td><span class="type-pill" [class.vsrc]="r.type === 'VOLTAGE_SOURCE'">{{ r.type }}</span></td>
                        <td>{{ getBranchValText(r.branchId) }}</td>
                        <td>{{ r.voltageDrop | number: '1.2-2' }} V</td>
                        <td class="current-cell">{{ formatCurrent(r.current) }}</td>
                        <td>{{ r.power | number: '1.2-2' }} W</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- SIDEBAR LATERAL: CONTROLES Y MEDICIONES -->
      <aside class="sidebar-panel">
        @if (activeMode() === 'ohm') {
          <!-- CONTROLES LEY DE OHM -->
          <div class="panel-section">
            <h3 class="section-title">Parámetros de la Ley de Ohm</h3>

            <div class="control-group">
              <div class="control-label">
                <span>Voltaje (V):</span>
                <strong>{{ ohmV() }} V</strong>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                [ngModel]="ohmV()"
                (ngModelChange)="ohmV.set($event)"
              />
            </div>

            <div class="control-group">
              <div class="control-label">
                <span>Resistencia (R):</span>
                <strong>{{ ohmR() }} Ω</strong>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                [ngModel]="ohmR()"
                (ngModelChange)="ohmR.set($event)"
              />
            </div>
          </div>

          <div class="panel-section">
            <h3 class="section-title">Resultados Computacionales</h3>

            <div class="metric-row highlight">
              <span class="label">Corriente (I = V/R):</span>
              <span class="value current">{{ ohmResult().current | number: '1.3-3' }} A</span>
            </div>

            <div class="metric-row highlight">
              <span class="label">Potencia Disipada (P = VI):</span>
              <span class="value power">{{ ohmResult().power | number: '1.2-2' }} W</span>
            </div>

            <div class="metric-row">
              <span class="label">Velocidad de Deriva (v_d):</span>
              <span class="value">{{ (ohmResult().driftVelocity * 1e6) | number: '1.2-2' }} µm/s</span>
            </div>

            <div class="metric-row">
              <span class="label">Temp. Resistor estimada:</span>
              <span class="value temp">{{ ohmResult().estimatedTemperatureC | number: '1.0-0' }} °C</span>
            </div>
          </div>
        } @else {
          <!-- CONTROLES DE LA RED MNA -->
          <div class="panel-section">
            <h3 class="section-title">Variables del Circuito</h3>

            <div class="control-group">
              <div class="control-label">
                <span>Fuente V1:</span>
                <strong>{{ netVoltage() }} V</strong>
              </div>
              <input
                type="range"
                min="1"
                max="48"
                step="1"
                [ngModel]="netVoltage()"
                (ngModelChange)="netVoltage.set($event)"
              />
            </div>

            <div class="control-group">
              <div class="control-label">
                <span>Resistencia R1:</span>
                <strong>{{ r1Val() }} Ω</strong>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                [ngModel]="r1Val()"
                (ngModelChange)="r1Val.set($event)"
              />
            </div>

            <div class="control-group">
              <div class="control-label">
                <span>Resistencia R2:</span>
                <strong>{{ r2Val() }} Ω</strong>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                [ngModel]="r2Val()"
                (ngModelChange)="r2Val.set($event)"
              />
            </div>

            @if (selectedTopology() === 'mixto' || selectedTopology() === 'wheatstone') {
              <div class="control-group">
                <div class="control-label">
                  <span>Resistencia R3:</span>
                  <strong>{{ r3Val() }} Ω</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  [ngModel]="r3Val()"
                  (ngModelChange)="r3Val.set($event)"
                />
              </div>

              <div class="control-group">
                <div class="control-label">
                  <span>Resistencia R4:</span>
                  <strong>{{ r4Val() }} Ω</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  [ngModel]="r4Val()"
                  (ngModelChange)="r4Val.set($event)"
                />
              </div>
            }
          </div>

          <div class="panel-section">
            <h3 class="section-title">Balance Energético Global</h3>
            <div class="metric-row">
              <span class="label">Potencia Suministrada:</span>
              <span class="value power">{{ mnaSolution().totalPowerSupplied | number: '1.2-2' }} W</span>
            </div>
            <div class="metric-row">
              <span class="label">Potencia Disipada:</span>
              <span class="value">{{ mnaSolution().totalPowerDissipated | number: '1.2-2' }} W</span>
            </div>
          </div>
        }
      </aside>
    </div>
  `,
  styles: [
    `
      .circuits-layout {
        display: flex;
        width: 100vw;
        height: calc(100vh - 56px);
        overflow: hidden;
        background: #020617;
      }

      .main-viewport {
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0.85rem;
        gap: 0.75rem;
        overflow-y: auto;
      }

      .sub-nav {
        display: flex;
        gap: 0.5rem;
      }

      .mode-btn {
        background: #0f172a;
        color: #94a3b8;
        border: 1px solid #334155;
        padding: 0.45rem 0.85rem;
        border-radius: 0.4rem;
        font-size: 0.78rem;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.15s;
      }

      .mode-btn.active {
        background: #0284c7;
        color: white;
        border-color: #38bdf8;
      }

      .ohm-view,
      .circuits-view {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .canvas-card,
      .schematic-card,
      .results-table-card {
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 0.6rem;
        padding: 0.75rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .card-title {
        font-weight: 700;
        font-size: 0.82rem;
        color: #f1f5f9;
      }

      .badge {
        font-size: 0.68rem;
        padding: 0.15rem 0.45rem;
        border-radius: 0.3rem;
      }

      .badge.live {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .badge.slope {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.3);
      }

      .badge.req {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .sim-canvas {
        background: #020617;
        border: 1px solid #1e293b;
        border-radius: 0.4rem;
        display: block;
        max-width: 100%;
      }

      .topo-selector {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .btn-topo {
        background: #1e293b;
        color: #94a3b8;
        border: 1px solid #334155;
        padding: 0.25rem 0.5rem;
        border-radius: 0.3rem;
        font-size: 0.72rem;
        cursor: pointer;
      }

      .btn-topo.active {
        background: #0284c7;
        color: white;
      }

      .btn-switch {
        background: #ef4444;
        color: white;
        border: none;
        padding: 0.3rem 0.65rem;
        border-radius: 0.3rem;
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-switch.closed {
        background: #22c55e;
      }

      .table-scroll {
        overflow-x: auto;
        max-height: 180px;
      }

      .mna-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.75rem;
        color: #cbd5e1;
      }

      .mna-table th,
      .mna-table td {
        padding: 0.4rem 0.5rem;
        text-align: left;
        border-bottom: 1px solid #1e293b;
      }

      .mna-table th {
        background: #1e293b;
        color: #94a3b8;
        font-weight: 600;
      }

      .type-pill {
        background: #334155;
        color: #e2e8f0;
        padding: 0.1rem 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.68rem;
      }

      .type-pill.vsrc {
        background: #0284c7;
        color: white;
      }

      .current-cell {
        color: #38bdf8;
        font-weight: 700;
      }

      /* SIDEBAR */
      .sidebar-panel {
        width: 340px;
        height: 100%;
        background: #0f172a;
        border-left: 1px solid #1e293b;
        color: #f1f5f9;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
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

      input[type='range'] {
        width: 100%;
        accent-color: #38bdf8;
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.78rem;
        margin-bottom: 0.35rem;
      }

      .metric-row.highlight {
        background: rgba(30, 41, 59, 0.7);
        padding: 0.35rem 0.5rem;
        border-radius: 0.35rem;
      }

      .value.current {
        color: #38bdf8;
        font-weight: 700;
      }

      .value.power {
        color: #4ade80;
        font-weight: 700;
      }

      .value.temp {
        color: #f59e0b;
        font-weight: 700;
      }
    `,
  ],
})
export class Unit3CircuitsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('ohmCanvas') ohmCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viGraphCanvas') viGraphCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('circuitCanvas') circuitCanvas?: ElementRef<HTMLCanvasElement>;

  activeMode = signal<'ohm' | 'circuits'>('ohm');

  // Modo Ley de Ohm
  ohmV = signal<number>(12); // 12V
  ohmR = signal<number>(4); // 4 Ohms
  private ohmEngine = new OhmEngine();

  ohmResult = computed<OhmCalculationResult>(() => {
    return this.ohmEngine.calculate({
      voltage: this.ohmV(),
      resistance: this.ohmR(),
    });
  });

  // Modo Redes de Circuitos (MNA Solver)
  selectedTopology = signal<CircuitTopology>('serie');
  netVoltage = signal<number>(12);
  r1Val = signal<number>(4);
  r2Val = signal<number>(8);
  r3Val = signal<number>(12);
  r4Val = signal<number>(6);
  isSwitchOpen = signal<boolean>(false);

  private mnaSolver = new MnaCircuitSolver();

  // Solución MNA calculada reactivamente
  mnaSolution = computed<CircuitSolution>(() => {
    const branches = this.buildCurrentBranches();
    return this.mnaSolver.solve(branches, '0');
  });

  private animFrameId: number | null = null;
  private electronOffset = 0;

  constructor() {
    effect(() => {
      // Forzar redraw cuando cambien los parámetros
      this.ohmV();
      this.ohmR();
      this.selectedTopology();
      this.netVoltage();
      this.r1Val();
      this.r2Val();
      this.r3Val();
      this.r4Val();
      this.isSwitchOpen();
      this.activeMode();

      this.drawViGraph();
      this.drawCircuitSchematic();
    });
  }

  ngAfterViewInit(): void {
    this.startAnimationLoop();
  }

  setTopology(t: CircuitTopology): void {
    this.selectedTopology.set(t);
  }

  private buildCurrentBranches(): CircuitBranch[] {
    const topo = this.selectedTopology();
    const v = this.netVoltage();
    const r1 = this.r1Val();
    const r2 = this.r2Val();
    const r3 = this.r3Val();
    const r4 = this.r4Val();
    const swOpen = this.isSwitchOpen();

    if (topo === 'serie') {
      return [
        { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: v, label: `V1 (${v}V)` },
        { id: 'sw1', type: 'SWITCH', nodeFrom: '1', nodeTo: '2', value: 0, isOpen: swOpen, label: 'SW1' },
        { id: 'r1', type: 'RESISTOR', nodeFrom: '2', nodeTo: '3', value: r1, label: `R1 (${r1}Ω)` },
        { id: 'r2', type: 'RESISTOR', nodeFrom: '3', nodeTo: '0', value: r2, label: `R2 (${r2}Ω)` },
      ];
    } else if (topo === 'paralelo') {
      return [
        { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: v, label: `V1 (${v}V)` },
        { id: 'sw1', type: 'SWITCH', nodeFrom: '1', nodeTo: '2', value: 0, isOpen: swOpen, label: 'SW1' },
        { id: 'r1', type: 'RESISTOR', nodeFrom: '2', nodeTo: '0', value: r1, label: `R1 (${r1}Ω)` },
        { id: 'r2', type: 'RESISTOR', nodeFrom: '2', nodeTo: '0', value: r2, label: `R2 (${r2}Ω)` },
      ];
    } else if (topo === 'mixto') {
      return [
        { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: v, label: `V1 (${v}V)` },
        { id: 'sw1', type: 'SWITCH', nodeFrom: '1', nodeTo: '2', value: 0, isOpen: swOpen, label: 'SW1' },
        { id: 'r1', type: 'RESISTOR', nodeFrom: '2', nodeTo: '3', value: r1, label: `R1 (${r1}Ω)` },
        { id: 'r2', type: 'RESISTOR', nodeFrom: '3', nodeTo: '0', value: r2, label: `R2 (${r2}Ω)` },
        { id: 'r3', type: 'RESISTOR', nodeFrom: '3', nodeTo: '0', value: r3, label: `R3 (${r3}Ω)` },
      ];
    } else {
      // Puente de Wheatstone
      return [
        { id: 'v1', type: 'VOLTAGE_SOURCE', nodeFrom: '1', nodeTo: '0', value: v, label: `V1 (${v}V)` },
        { id: 'sw1', type: 'SWITCH', nodeFrom: '1', nodeTo: '2', value: 0, isOpen: swOpen, label: 'SW1' },
        { id: 'r1', type: 'RESISTOR', nodeFrom: '2', nodeTo: 'C', value: r1, label: `R1 (${r1}Ω)` },
        { id: 'r2', type: 'RESISTOR', nodeFrom: 'C', nodeTo: '0', value: r2, label: `R2 (${r2}Ω)` },
        { id: 'r3', type: 'RESISTOR', nodeFrom: '2', nodeTo: 'D', value: r3, label: `R3 (${r3}Ω)` },
        { id: 'r4', type: 'RESISTOR', nodeFrom: 'D', nodeTo: '0', value: r4, label: `R4 (${r4}Ω)` },
        { id: 'rg', type: 'RESISTOR', nodeFrom: 'C', nodeTo: 'D', value: 25, label: 'Galvanómetro (25Ω)' },
      ];
    }
  }

  getBranchValText(branchId: string): string {
    const branches = this.buildCurrentBranches();
    const b = branches.find((x) => x.id === branchId);
    if (!b) return '-';
    if (b.type === 'VOLTAGE_SOURCE') return `${b.value} V`;
    if (b.type === 'RESISTOR') return `${b.value} Ω`;
    if (b.type === 'SWITCH') return b.isOpen ? 'Abierto' : 'Cerrado';
    return '-';
  }

  formatCurrent(amps: number): string {
    const absI = Math.abs(amps);
    if (absI < 1e-4) return '0.00 mA';
    if (absI < 1) return `${(amps * 1000).toFixed(2)} mA`;
    return `${amps.toFixed(3)} A`;
  }

  private startAnimationLoop(): void {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);

      if (this.activeMode() === 'ohm') {
        const i = this.ohmResult().current;
        // Velocidad de animación de electrones proporcional a I
        this.electronOffset += Math.min(i * 1.5, 12);
        this.drawOhmSimulation();
      } else {
        this.electronOffset += 1.5;
        this.drawCircuitSchematic();
      }
    };
    loop();
  }

  private drawOhmSimulation(): void {
    if (!this.ohmCanvas) return;
    const canvas = this.ohmCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pad = 40;
    const left = pad;
    const right = w - pad;
    const top = pad;
    const bottom = h - pad;

    // Alambre conductor principal
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeRect(left, top, right - left, bottom - top);

    // Fuente de Voltaje (Batería a la izquierda)
    const midY = (top + bottom) / 2;
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(left - 10, midY - 25, 20, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`${this.ohmV()}V`, left - 35, midY + 4);
    ctx.fillText('+', left - 6, midY - 30);
    ctx.fillText('-', left - 4, midY + 38);

    // Resistor a la derecha con calentamiento Joule
    const p = this.ohmResult().power;
    // Tinte térmico de gris frío a naranja/rojo incandescente
    const heatFrac = Math.min(p / 50, 1.0);
    const rColor = heatFrac > 0.5 ? '#ef4444' : heatFrac > 0.2 ? '#f59e0b' : '#64748b';

    ctx.fillStyle = rColor;
    ctx.fillRect(right - 14, midY - 35, 28, 70);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.strokeRect(right - 14, midY - 35, 28, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`${this.ohmR()}Ω`, right + 18, midY + 4);

    // Animación de Electrones (fluyendo en sentido contrario a la corriente convencional)
    const perim = 2 * (right - left) + 2 * (bottom - top);
    const numElectrons = 20;

    ctx.fillStyle = '#38bdf8';
    for (let e = 0; e < numElectrons; e++) {
      const dist = (this.electronOffset + (e * perim) / numElectrons) % perim;
      const pt = this.getPointOnRect(dist, left, top, right, bottom);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Indicador de corriente I en el conductor superior
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(`I = ${this.ohmResult().current.toFixed(2)} A →`, (left + right) / 2 - 40, top - 12);
  }

  private getPointOnRect(dist: number, l: number, t: number, r: number, b: number): { x: number; y: number } {
    const w = r - l;
    const h = b - t;

    // Camino horario: Top -> Right -> Bottom -> Left
    if (dist < w) return { x: l + dist, y: t };
    dist -= w;
    if (dist < h) return { x: r, y: t + dist };
    dist -= h;
    if (dist < w) return { x: r - dist, y: b };
    dist -= w;
    return { x: l, y: b - dist };
  }

  private drawViGraph(): void {
    if (!this.viGraphCanvas) return;
    const canvas = this.viGraphCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 40;
    const padB = 30;
    const plotW = w - padL - 20;
    const plotH = h - padB - 20;

    // Ejes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, 10);
    ctx.lineTo(padL, h - padB);
    ctx.lineTo(w - 10, h - padB);
    ctx.stroke();

    // Recta característica V = I * R (Eje X: Corriente I, Eje Y: Voltaje V)
    const maxI = 10; // 0 a 10 A
    const maxV = 30; // 0 a 30 V
    const r = this.ohmR();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);

    const testI = maxV / r;
    const xEnd = padL + Math.min(testI / maxI, 1) * plotW;
    const yEnd = h - padB - Math.min((testI * r) / maxV, 1) * plotH;
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    // Punto de operación actual
    const curI = this.ohmResult().current;
    const curV = this.ohmV();
    const curX = padL + Math.min(curI / maxI, 1) * plotW;
    const curY = h - padB - Math.min(curV / maxV, 1) * plotH;

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Etiquetas de ejes
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('Voltaje V [V]', 5, 15);
    ctx.fillText('Corriente I [A]', w - 60, h - 10);
    ctx.fillText(`(${curI.toFixed(2)} A, ${curV.toFixed(1)} V)`, curX + 8, curY - 6);
  }

  private drawCircuitSchematic(): void {
    if (!this.circuitCanvas) return;
    const canvas = this.circuitCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const topo = this.selectedTopology();
    const v = this.netVoltage();
    const isSwOpen = this.isSwitchOpen();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Fuente a la izquierda (común a todas las topologías)
    ctx.strokeRect(40, 40, w - 80, h - 80);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(30, h / 2 - 20, 20, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`${v}V`, 5, h / 2 + 4);

    // Interruptor en la rama superior
    ctx.fillStyle = isSwOpen ? '#ef4444' : '#22c55e';
    ctx.fillRect(100, 32, 28, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText(isSwOpen ? 'OFF' : 'ON', 106, 44);

    // Dibujar resistores según la topología
    if (topo === 'serie') {
      this.drawResistorBox(ctx, (w / 2) - 30, 40, `R1=${this.r1Val()}Ω`);
      this.drawResistorBox(ctx, w - 40, h / 2, `R2=${this.r2Val()}Ω`, true);
    } else if (topo === 'paralelo') {
      // Rama vertical intermedia
      ctx.beginPath();
      ctx.moveTo(w / 2, 40);
      ctx.lineTo(w / 2, h - 40);
      ctx.stroke();

      this.drawResistorBox(ctx, w / 2, h / 2, `R1=${this.r1Val()}Ω`, true);
      this.drawResistorBox(ctx, w - 40, h / 2, `R2=${this.r2Val()}Ω`, true);
    } else if (topo === 'mixto') {
      this.drawResistorBox(ctx, 180, 40, `R1=${this.r1Val()}Ω`);
      ctx.beginPath();
      ctx.moveTo(w - 140, 40);
      ctx.lineTo(w - 140, h - 40);
      ctx.stroke();

      this.drawResistorBox(ctx, w - 140, h / 2, `R2=${this.r2Val()}Ω`, true);
      this.drawResistorBox(ctx, w - 40, h / 2, `R3=${this.r3Val()}Ω`, true);
    } else {
      // Puente Wheatstone
      this.drawResistorBox(ctx, 160, 40, `R1=${this.r1Val()}Ω`);
      this.drawResistorBox(ctx, w - 140, 40, `R3=${this.r3Val()}Ω`);
      this.drawResistorBox(ctx, 160, h - 40, `R2=${this.r2Val()}Ω`);
      this.drawResistorBox(ctx, w - 140, h - 40, `R4=${this.r4Val()}Ω`);

      // Galvanómetro vertical central
      ctx.beginPath();
      ctx.moveTo(w / 2, 40);
      ctx.lineTo(w / 2, h - 40);
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
      this.drawResistorBox(ctx, w / 2, h / 2, 'Galv', true);
    }
  }

  private drawResistorBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    vertical = false
  ): void {
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;

    if (vertical) {
      ctx.fillRect(x - 12, y - 24, 24, 48);
      ctx.strokeRect(x - 12, y - 24, 24, 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(label, x + 16, y + 4);
    } else {
      ctx.fillRect(x - 24, y - 12, 48, 24);
      ctx.strokeRect(x - 24, y - 12, 48, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(label, x - 20, y - 16);
    }
    ctx.restore();
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}
