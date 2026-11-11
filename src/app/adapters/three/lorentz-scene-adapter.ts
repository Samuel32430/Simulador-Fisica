import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vector3D } from '../../core/math/vector3d';
import { MagneticSourceConfig, MagneticEngine } from '../../core/physics/magnetics/magnetic-engine';
import { ParticleState } from '../../core/physics/magnetics/boris-integrator';

export class LorentzSceneAdapter {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;

  private container!: HTMLElement;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Grupos 3D
  private rootGroup = new THREE.Group();
  private sourceGroup = new THREE.Group();
  private vectorMesh: THREE.InstancedMesh | null = null;
  private trajectoryLine!: THREE.Line;
  private particleMesh!: THREE.Mesh;

  private engine = new MagneticEngine();
  private trajectoryPoints: ParticleState[] = [];
  private currentFrame = 0;
  private isAnimating = false;

  init(container: HTMLElement): void {
    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(4, -5.5, 4.5);
    this.camera.up.set(0, 0, 1);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      container.appendChild(this.renderer.domElement);
    } catch {
      return;
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 25;
    this.controls.minDistance = 1;

    // Iluminación
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(5, 5, 8);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x10b981, 0.4);
    dirLight2.position.set(-5, -5, -4);
    this.scene.add(dirLight2);

    // Rejilla de referencia
    const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);

    // Ejes de coordenadas
    const axes = new THREE.AxesHelper(1.5);
    this.scene.add(axes);

    // Inicializar malla de trayectoria y partícula
    const pGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
    });
    this.particleMesh = new THREE.Mesh(pGeom, pMat);
    this.particleMesh.visible = false;
    this.rootGroup.add(this.particleMesh);

    const lineGeom = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    this.trajectoryLine = new THREE.Line(lineGeom, lineMat);
    this.rootGroup.add(this.trajectoryLine);

    this.rootGroup.add(this.sourceGroup);
    this.scene.add(this.rootGroup);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  updateMagneticField(config: MagneticSourceConfig, showVectors: boolean): void {
    if (!this.renderer) return;

    // 1. Limpiar geometría de la fuente magnética
    while (this.sourceGroup.children.length > 0) {
      const child = this.sourceGroup.children[0];
      this.sourceGroup.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }

    // 2. Construir objeto 3D de la fuente
    if (config.type === 'WIRE') {
      const cylinderGeom = new THREE.CylinderGeometry(0.08, 0.08, 6.0, 16);
      const wireMat = new THREE.MeshStandardMaterial({
        color: 0xd97706, // Cobre
        metalness: 0.9,
        roughness: 0.2,
      });
      const wireMesh = new THREE.Mesh(cylinderGeom, wireMat);
      wireMesh.rotation.x = Math.PI / 2;
      this.sourceGroup.add(wireMesh);
    } else if (config.type === 'LOOP') {
      const torusGeom = new THREE.TorusGeometry(config.loopRadius, 0.06, 16, 48);
      const loopMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.8,
        roughness: 0.3,
      });
      const loopMesh = new THREE.Mesh(torusGeom, loopMat);
      this.sourceGroup.add(loopMesh);
    } else if (config.type === 'DIPOLE') {
      // Imán de barra con polos N (rojo) y S (azul)
      const barN = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      );
      barN.position.z = 0.4;
      const barS = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
      );
      barS.position.z = -0.4;
      this.sourceGroup.add(barN);
      this.sourceGroup.add(barS);
    }

    // 3. Reconstruir malla de vectores de campo magnético B
    this.rebuildVectorField(config, showVectors);
  }

  private rebuildVectorField(config: MagneticSourceConfig, showVectors: boolean): void {
    if (this.vectorMesh) {
      this.scene.remove(this.vectorMesh);
      this.vectorMesh.geometry.dispose();
      (this.vectorMesh.material as THREE.Material).dispose();
      this.vectorMesh = null;
    }

    if (!showVectors) return;

    // Rejilla tridimensional de puntos
    const span = 2.5;
    const step = 0.8;
    const points: Vector3D[] = [];

    for (let x = -span; x <= span; x += step) {
      for (let y = -span; y <= span; y += step) {
        for (let z = -span * 0.6; z <= span * 0.6; z += step) {
          points.push(new Vector3D(x, y, z));
        }
      }
    }

    const coneGeom = new THREE.ConeGeometry(0.08, 0.35, 8);
    coneGeom.translate(0, 0.175, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    this.vectorMesh = new THREE.InstancedMesh(coneGeom, material, points.length);
    const dummy = new THREE.Object3D();
    const upVector = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const bField = this.engine.calculateMagneticField(pt, config);
      const mag = bField.norm();

      if (mag < 1e-6) {
        dummy.scale.set(0, 0, 0);
      } else {
        dummy.position.set(pt.x, pt.y, pt.z);
        const dir = new THREE.Vector3(bField.x / mag, bField.y / mag, bField.z / mag);
        dummy.quaternion.setFromUnitVectors(upVector, dir);
        const s = Math.min(Math.max(mag * 0.35, 0.15), 0.6);
        dummy.scale.set(s, s, s);
      }
      dummy.updateMatrix();
      this.vectorMesh.setMatrixAt(i, dummy.matrix);
    }

    this.vectorMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.vectorMesh);
  }

  setTrajectory(points: ParticleState[]): void {
    this.trajectoryPoints = points;
    this.currentFrame = 0;
    this.isAnimating = points.length > 0;
    this.particleMesh.visible = this.isAnimating;

    if (!this.isAnimating) {
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine.geometry = new THREE.BufferGeometry();
      return;
    }

    // Dibujar línea completa de trayectoria
    const line3d = points.map((p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z));
    this.trajectoryLine.geometry.dispose();
    this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(line3d);
  }

  clearTrajectory(): void {
    this.isAnimating = false;
    this.particleMesh.visible = false;
    this.trajectoryLine.geometry.dispose();
    this.trajectoryLine.geometry = new THREE.BufferGeometry();
    this.trajectoryPoints = [];
  }

  private onResize(): void {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    if (!this.renderer) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls?.update();

    // Animación de la partícula a lo largo de su órbita
    if (this.isAnimating && this.trajectoryPoints.length > 0) {
      const p = this.trajectoryPoints[this.currentFrame];
      this.particleMesh.position.set(p.position.x, p.position.y, p.position.z);
      this.currentFrame = (this.currentFrame + 2) % this.trajectoryPoints.length;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    if (this.renderer?.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
