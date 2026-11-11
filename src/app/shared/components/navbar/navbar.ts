import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SimulationStateService,
  SIMULATION_UNITS,
  SimulationUnit,
} from '../../services/simulation-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="navbar">
      <div class="brand">
        <div class="logo-icon">⚡</div>
        <div class="brand-text">
          <span class="app-title">Simulador Electromagnético 3D</span>
          <span class="app-subtitle">Cálculo Científico • Clean Architecture • Three.js</span>
        </div>
      </div>

      <nav class="unit-tabs">
        @for (unit of units; track unit.id) {
          <button
            class="tab-btn"
            [class.active]="state.currentUnit() === unit.id"
            (click)="selectUnit(unit.id)"
          >
            <span class="unit-badge">{{ unit.badge }}</span>
            <span class="tab-label">{{ unit.title }}</span>
          </button>
        }
      </nav>

      <div class="actions">
        <span class="team-badge">Equipo de 3 • Modular</span>
      </div>
    </header>
  `,
  styles: [
    `
      .navbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #0b1120;
        border-bottom: 1px solid #1e293b;
        padding: 0.6rem 1.25rem;
        color: #f8fafc;
        user-select: none;
        z-index: 50;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .logo-icon {
        font-size: 1.5rem;
        background: #1e293b;
        padding: 0.25rem 0.5rem;
        border-radius: 0.5rem;
        border: 1px solid #38bdf8;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
      }

      .app-title {
        font-weight: 700;
        font-size: 1rem;
        color: #f1f5f9;
        letter-spacing: -0.01em;
      }

      .app-subtitle {
        font-size: 0.72rem;
        color: #94a3b8;
      }

      .unit-tabs {
        display: flex;
        gap: 0.4rem;
        background: #0f172a;
        padding: 0.25rem;
        border-radius: 0.5rem;
        border: 1px solid #1e293b;
      }

      .tab-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 0.4rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .tab-btn:hover {
        color: #e2e8f0;
        background: #1e293b;
      }

      .tab-btn.active {
        background: #0284c7;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      .unit-badge {
        font-size: 0.68rem;
        background: rgba(255, 255, 255, 0.15);
        padding: 0.1rem 0.35rem;
        border-radius: 0.25rem;
      }

      .tab-label {
        white-space: nowrap;
      }

      .team-badge {
        font-size: 0.75rem;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.25);
        padding: 0.25rem 0.6rem;
        border-radius: 9999px;
        font-weight: 500;
      }

      @media (max-width: 900px) {
        .tab-label {
          display: none;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  readonly state = inject(SimulationStateService);
  readonly units = SIMULATION_UNITS;

  selectUnit(unit: SimulationUnit): void {
    this.state.setUnit(unit);
  }
}
