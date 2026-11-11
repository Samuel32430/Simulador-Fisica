import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vector3D } from '../../core/math/vector3d';

export interface SceneCallbacks {
  onChargeSelected?: (chargeId: string) => void;
  onChargeMoved?: (chargeId: string, newPos: Vector3D) => void;
}

/**
 * Gestor de la escena Three.js: Renderizador WebGL, Cámara, Iluminación, Controles Orbitales y Raycasting.
 */
export class ThreeSceneManager {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;

  private container!: HTMLElement;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Raycasting para interactividad con el ratón
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Plano XY (Z = 0)
  private planeIntersect = new THREE.Vector3();
  private isDragging = false;
  private draggedMesh: THREE.Object3D | null = null;

  private interactiveObjects: Map<string, THREE.Object3D> = new Map();
  private callbacks: SceneCallbacks = {};

  init(container: HTMLElement, callbacks: SceneCallbacks = {}): void {
    this.container = container;
    this.callbacks = callbacks;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Escena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Slate 900 oscuro

    // 2. Cámara
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, -4.5, 5.5);
    this.camera.up.set(0, 0, 1); // Eje Z hacia arriba

    // 3. Renderizador WebGL (tolerante a entornos sin GPU como jsdom en tests unitarios)
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
      // Entorno sin soporte WebGL (p. ej. ejecución de pruebas unitarias headless con jsdom)
      return;
    }

    // 4. Controles orbitales
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 25;
    this.controls.minDistance = 1;

    // 5. Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(5, 5, 10);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
    dirLight2.position.set(-5, -5, -5);
    this.scene.add(dirLight2);

    // 6. Guías visuales (Rejilla y Ejes)
    const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    gridHelper.rotation.x = Math.PI / 2; // Orientar en plano XY
    this.scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(1.5);
    this.scene.add(axesHelper);

    // 7. Eventos de ratón
    this.setupInteractivity();

    // 8. Auto-redimensionamiento
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    // 9. Bucle de animación
    this.animate();
  }

  private setupInteractivity(): void {
    const dom = this.renderer.domElement;

    const getMousePos = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    dom.addEventListener('pointerdown', (e) => {
      getMousePos(e);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const objects = Array.from(this.interactiveObjects.values());
      const intersects = this.raycaster.intersectObjects(objects, true);

      if (intersects.length > 0) {
        // Encontrar objeto raíz registrado
        let hit: THREE.Object3D | null = intersects[0].object;
        while (hit && !hit.userData['chargeId'] && hit.parent) {
          hit = hit.parent;
        }

        if (hit && hit.userData['chargeId']) {
          this.isDragging = true;
          this.draggedMesh = hit;
          this.controls.enabled = false; // Desactivar rotación mientras se arrastra
          const chargeId = hit.userData['chargeId'];
          this.callbacks.onChargeSelected?.(chargeId);
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging || !this.draggedMesh) return;
      getMousePos(e);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
        const id = this.draggedMesh.userData['chargeId'];
        const newPos = new Vector3D(this.planeIntersect.x, this.planeIntersect.y, 0);
        this.callbacks.onChargeMoved?.(id, newPos);
      }
    });

    const stopDragging = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.draggedMesh = null;
        this.controls.enabled = true;
      }
    };

    window.addEventListener('pointerup', stopDragging);
  }

  registerInteractiveObject(id: string, obj: THREE.Object3D): void {
    obj.userData['chargeId'] = id;
    this.interactiveObjects.set(id, obj);
  }

  clearInteractiveObjects(): void {
    this.interactiveObjects.clear();
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
