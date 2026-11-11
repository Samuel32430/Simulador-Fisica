import * as THREE from 'three';
import { Charge3D } from '../../core/physics/electrostatics/charge3d';
import { ThreeSceneManager } from './three-scene-manager';

/**
 * Adaptador visual para renderizar cargas eléctricas en 3D con brillo e indicadores de signo.
 */
export class ChargeRenderer {
  private group = new THREE.Group();
  private sphereGeom = new THREE.SphereGeometry(0.2, 32, 32);
  private ringGeom = new THREE.RingGeometry(0.26, 0.32, 32);

  // Materiales compartidos para evitar recreación innecesaria en GPU
  private posMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Rojo carmesí
    emissive: 0x991b1b,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.3,
  });

  private negMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, // Azul cobalto
    emissive: 0x1e40af,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.3,
  });

  private selectionMaterial = new THREE.MeshBasicMaterial({
    color: 0xfacc15, // Amarillo ámbar
    side: THREE.DoubleSide,
  });

  constructor(private sceneManager: ThreeSceneManager) {
    this.sceneManager.scene.add(this.group);
  }

  update(charges: Charge3D[], selectedId: string | null): void {
    // 1. Limpiar objetos previos del grupo
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.sceneManager.clearInteractiveObjects();

    // 2. Renderizar cada carga
    for (const ch of charges) {
      const chargeMeshGroup = new THREE.Group();
      chargeMeshGroup.position.set(ch.position.x, ch.position.y, ch.position.z);

      const isPos = ch.q > 0;
      const sphere = new THREE.Mesh(
        this.sphereGeom,
        isPos ? this.posMaterial : this.negMaterial
      );
      chargeMeshGroup.add(sphere);

      // Anillo de selección si es la carga activa
      if (ch.id === selectedId) {
        const ring = new THREE.Mesh(this.ringGeom, this.selectionMaterial);
        ring.rotation.x = 0;
        chargeMeshGroup.add(ring);
      }

      // Luz puntual local sutil
      const pointLight = new THREE.PointLight(
        isPos ? 0xef4444 : 0x3b82f6,
        1.5,
        1.5
      );
      chargeMeshGroup.add(pointLight);

      this.group.add(chargeMeshGroup);
      this.sceneManager.registerInteractiveObject(ch.id, chargeMeshGroup);
    }
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.group);
    this.sphereGeom.dispose();
    this.ringGeom.dispose();
    this.posMaterial.dispose();
    this.negMaterial.dispose();
    this.selectionMaterial.dispose();
  }
}
