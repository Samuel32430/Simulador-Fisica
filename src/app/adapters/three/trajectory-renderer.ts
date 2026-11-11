import * as THREE from 'three';
import { Charge3D } from '../../core/physics/electrostatics/charge3d';
import { Vector3D } from '../../core/math/vector3d';
import { TestChargeDynamics, TrajectoryPoint } from '../../core/physics/electrostatics/test-charge-dynamics';
import { ThreeSceneManager } from './three-scene-manager';

/**
 * Renderizador de animación de partículas de prueba y estela de trayectoria.
 */
export class TrajectoryRenderer {
  private group = new THREE.Group();
  private particleMesh: THREE.Mesh;
  private trailLine: THREE.Line;
  private dynamics = new TestChargeDynamics();

  private trajectoryPoints: TrajectoryPoint[] = [];
  private currentFrame = 0;
  private isPlaying = false;

  constructor(private sceneManager: ThreeSceneManager) {
    // Esfera de la partícula de prueba (color ámbar brillante)
    const geom = new THREE.SphereGeometry(0.12, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    this.particleMesh = new THREE.Mesh(geom, mat);
    this.particleMesh.visible = false;
    this.group.add(this.particleMesh);

    // Línea de la estela
    const lineGeom = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.8,
    });
    this.trailLine = new THREE.Line(lineGeom, lineMat);
    this.group.add(this.trailLine);

    this.sceneManager.scene.add(this.group);
  }

  launch(
    startPos: Vector3D,
    initialVel: Vector3D,
    qTest: number,
    charges: Charge3D[]
  ): void {
    this.trajectoryPoints = this.dynamics.simulateTrajectory(
      {
        q: qTest,
        mass: 1e-4, // masa manejable
        initialPosition: startPos,
        initialVelocity: initialVel,
        dt: 0.005,
        maxSteps: 300,
      },
      charges
    );

    this.currentFrame = 0;
    this.isPlaying = true;
    this.particleMesh.visible = true;
    this.animateStep();
  }

  private animateStep = (): void => {
    if (!this.isPlaying || this.trajectoryPoints.length === 0) return;

    if (this.currentFrame >= this.trajectoryPoints.length) {
      this.isPlaying = false;
      return;
    }

    const currentPt = this.trajectoryPoints[this.currentFrame];
    this.particleMesh.position.set(
      currentPt.position.x,
      currentPt.position.y,
      currentPt.position.z
    );

    // Actualizar estela
    const pathUntilNow = this.trajectoryPoints
      .slice(0, this.currentFrame + 1)
      .map((p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z));

    this.trailLine.geometry.dispose();
    this.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(pathUntilNow);

    this.currentFrame++;
    setTimeout(() => this.animateStep(), 20); // ~50 fps
  };

  clear(): void {
    this.isPlaying = false;
    this.particleMesh.visible = false;
    this.trailLine.geometry.dispose();
    this.trailLine.geometry = new THREE.BufferGeometry();
    this.trajectoryPoints = [];
  }

  dispose(): void {
    this.clear();
    this.sceneManager.scene.remove(this.group);
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    (this.trailLine.material as THREE.Material).dispose();
  }
}
