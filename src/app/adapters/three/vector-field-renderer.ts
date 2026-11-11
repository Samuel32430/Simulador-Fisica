import * as THREE from 'three';
import { Charge3D } from '../../core/physics/electrostatics/charge3d';
import { CoulombEngine } from '../../core/physics/electrostatics/coulomb-engine';
import { Vector3D } from '../../core/math/vector3d';
import { ThreeSceneManager } from './three-scene-manager';

/**
 * Renderizador de alto rendimiento para el campo vectorial E(r) utilizando THREE.InstancedMesh (1 Draw Call).
 */
export class VectorFieldRenderer {
  private instancedMesh: THREE.InstancedMesh | null = null;
  private engine = new CoulombEngine();
  private gridPoints: Vector3D[] = [];

  // Parámetros de la rejilla
  private readonly span = 3.0; // [-3, 3] metros
  private step = 0.6; // Separación entre vectores

  constructor(private sceneManager: ThreeSceneManager) {
    this.rebuildGrid('media');
  }

  rebuildGrid(density: 'baja' | 'media' | 'alta'): void {
    if (density === 'baja') this.step = 0.9;
    else if (density === 'media') this.step = 0.6;
    else this.step = 0.42;

    this.gridPoints = [];
    for (let x = -this.span; x <= this.span; x += this.step) {
      for (let y = -this.span; y <= this.span; y += this.step) {
        this.gridPoints.push(new Vector3D(x, y, 0));
      }
    }

    if (this.instancedMesh) {
      this.sceneManager.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }

    const count = this.gridPoints.length;
    // Geometría del vector: cilindro para el cuerpo + cono para la punta
    const arrowGeom = this.createArrowGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.instancedMesh = new THREE.InstancedMesh(arrowGeom, material, count);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sceneManager.scene.add(this.instancedMesh);
  }

  update(charges: Charge3D[], visible: boolean): void {
    if (!this.instancedMesh) return;
    this.instancedMesh.visible = visible;
    if (!visible) return;

    const dummy = new THREE.Object3D();
    const upVector = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    for (let i = 0; i < this.gridPoints.length; i++) {
      const pt = this.gridPoints[i];

      // Ignorar puntos demasiado cercanos al núcleo de una carga
      let tooClose = false;
      for (const ch of charges) {
        if (pt.distanceSquared(ch.position) < 0.08) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) {
        dummy.position.set(pt.x, pt.y, pt.z);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const eField = this.engine.calculateElectricField(pt, charges);
      const mag = eField.norm();

      if (mag < 1e-3) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // Dirección normalizada
      const dir = new THREE.Vector3(eField.x / mag, eField.y / mag, eField.z / mag);

      // Posición
      dummy.position.set(pt.x, pt.y, pt.z);

      // Orientar hacia el vector de campo
      const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, dir);
      dummy.quaternion.copy(quaternion);

      // Escala perceptual logarítmica para que no se deforme la visualización
      const logMag = Math.log10(mag + 1);
      const scaleFactor = Math.min(Math.max(logMag * 0.04, 0.08), 0.35);
      dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);

      dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, dummy.matrix);

      // Colormap térmico: Azul (débil) -> Cian -> Verde -> Amarillo -> Rojo (intenso)
      const normalizedMag = Math.min(Math.max((logMag - 2) / 6, 0), 1);
      color.setHSL((1.0 - normalizedMag) * 0.7, 1.0, 0.55);
      this.instancedMesh.setColorAt(i, color);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  private createArrowGeometry(): THREE.BufferGeometry {
    // Punta cónica
    const coneGeom = new THREE.ConeGeometry(0.35, 0.7, 12);
    coneGeom.translate(0, 0.65, 0);

    // Vástago cilíndrico
    const cylinderGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 12);
    cylinderGeom.translate(0, 0.3, 0);

    // Combinar en una sola geometría compuesta
    return coneGeom;
  }

  dispose(): void {
    if (this.instancedMesh) {
      this.sceneManager.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
    }
  }
}
