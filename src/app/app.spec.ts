import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('debe inicializar el componente principal App con éxito', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('debe contener el título del simulador en el navbar sin subtítulo ni badge de equipo', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-title')?.textContent).toContain(
      'Simulador Electromagnético 3D'
    );
    expect(compiled.querySelector('.app-subtitle')).toBeNull();
    expect(compiled.querySelector('.team-badge')).toBeNull();
    expect(compiled.querySelectorAll('.unit-tabs .tab-btn').length).toBe(4);
  });
});
