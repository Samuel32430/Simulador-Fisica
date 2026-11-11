import * as THREE from 'three';
import { Charge3D } from '../../core/physics/electrostatics/charge3d';
import { FieldLineTracer } from '../../core/physics/electrostatics/fieldline-tracer';
import { ThreeSceneManager } from './three-scene-manager';

/**
 * Renderizador de líneas de flujo electrostático generadas mediante RK4.
 */
export class FieldLineRenderer {
  private group = new THREE.Group();
  private tracer = new FieldLineTracer();

  private lineMaterial = new THREE.LineBasicMaterial({
    color: 0x38bdf8, // Azul cian luminoso
    transparent: true,
    opacity: 0.65,
    linewidth: 1,
  });

  constructor(private sceneManager: ThreeSceneManager) {
    this.sceneManager.scene.add(this.group);
  }

  update(charges: Charge3D[], visible: boolean): void {
    // 1. Limpiar líneas previas
    while (this.group.children.length > 0) {
      const child = this.group.children[0] as THREE.Line;
      this.group.remove(child);
      child.geometry.dispose();
    }

    this.group.visible = visible;
    if (!visible || charges.length === 0) return;

    // 2. Trazar líneas con Runge-Kutta 4
    const lines = this.tracer.traceAllFieldLines(charges);

    // 3. Crear objetos de línea en Three.js
    for (const linePoints of lines) {
      if (linePoints.length < 2) continue;

      const points3D = linePoints.map(
        (p) => new THREE.Vector3(p.x, p.y, p.z)
      );
      const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
      const lineMesh = new THREE.Line(geometry, this.lineMaterial);

      this.group.add(lineMesh);
    }
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.group);
    this.lineMaterial.dispose();
  }
}
