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
        <div class="logo-icon" aria-hidden="true">⚡</div>
        <span class="app-title">Simulador Electromagnético 3D</span>
      </div>

      <nav class="unit-tabs" aria-label="Unidades del simulador">
        @for (unit of units; track unit.id) {
          <button
            type="button"
            class="tab-btn"
            [class.active]="state.currentUnit() === unit.id"
            [attr.title]="unit.title + ' — ' + unit.description"
            (click)="selectUnit(unit.id)"
          >
            <span class="unit-badge">{{ unit.shortCode }}</span>
            <span class="tab-label">{{ unit.shortTitle }}</span>
          </button>
        }
      </nav>
    </header>
  `,
  styles: [
    `
      .navbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        height: 56px;
        background: #0b1120;
        border-bottom: 1px solid #1e293b;
        padding: 0 1.25rem;
        color: #f8fafc;
        user-select: none;
        z-index: 50;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-shrink: 0;
      }

      .logo-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        font-size: 1.15rem;
        background: #1e293b;
        border-radius: 0.5rem;
        border: 1px solid #38bdf8;
        flex-shrink: 0;
      }

      .app-title {
        font-weight: 700;
        font-size: 0.98rem;
        color: #f1f5f9;
        letter-spacing: -0.01em;
        white-space: nowrap;
      }

      .unit-tabs {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: #0f172a;
        padding: 0.25rem;
        border-radius: 0.55rem;
        border: 1px solid #1e293b;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .unit-tabs::-webkit-scrollbar {
        display: none;
      }

      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        flex-shrink: 0;
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 0.38rem 0.7rem;
        border-radius: 0.4rem;
        font-size: 0.78rem;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;
      }

      .tab-btn:hover {
        color: #e2e8f0;
        background: #1e293b;
      }

      .tab-btn.active {
        background: #0284c7;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
      }

      .unit-badge {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        background: rgba(255, 255, 255, 0.12);
        color: #cbd5e1;
        padding: 0.12rem 0.38rem;
        border-radius: 0.25rem;
        white-space: nowrap;
      }

      .tab-btn.active .unit-badge {
        background: rgba(255, 255, 255, 0.22);
        color: #ffffff;
      }

      .tab-label {
        white-space: nowrap;
      }

      @media (max-width: 1080px) {
        .navbar {
          padding: 0 0.75rem;
          gap: 0.65rem;
        }

        .app-title {
          font-size: 0.88rem;
        }

        .tab-btn {
          padding: 0.35rem 0.55rem;
          font-size: 0.74rem;
        }
      }

      @media (max-width: 780px) {
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
