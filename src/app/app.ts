import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/components/navbar/navbar';
import { Unit1ElectrostaticsComponent } from './features/unit1-electrostatics/unit1-electrostatics';
import { Unit2CapacitorsComponent } from './features/unit2-capacitors/unit2-capacitors';
import { Unit3CircuitsComponent } from './features/unit3-circuits/unit3-circuits';
import { Unit4MagnetismComponent } from './features/unit4-magnetism/unit4-magnetism';
import { SimulationStateService } from './shared/services/simulation-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    Unit1ElectrostaticsComponent,
    Unit2CapacitorsComponent,
    Unit3CircuitsComponent,
    Unit4MagnetismComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly state = inject(SimulationStateService);
}
