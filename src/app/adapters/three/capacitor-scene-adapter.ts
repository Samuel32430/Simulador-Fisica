import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DielectricMaterial } from '../../core/physics/capacitors/dielectric-materials';
import { CapacitorCalculationResult } from '../../core/physics/capacitors/capacitor-engine';

export interface CapacitorVisualParams {
  areaM2: number;
  separationM: number;
  voltageV: number;
  dielectric: DielectricMaterial;
  insertion: number; // 0 a 1
  calcResult: CapacitorCalculationResult;
}

export class CapacitorSceneAdapter {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;

  private container!: HTMLElement;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Grupos de la escena 3D
  private rootGroup = new THREE.Group();
  private topPlateGroup = new THREE.Group();
  private bottomPlateGroup = new THREE.Group();
  private dielectricMesh!: THREE.Mesh;
  private fieldLinesGroup = new THREE.Group();
  private arcDischargeGroup = new THREE.Group();

  // Materiales de placas metálicas
  private topPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Rojo para placa positiva
    metalness: 0.85,
    roughness: 0.25,
  });

  private bottomPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, // Azul para placa negativa
    metalness: 0.85,
    roughness: 0.25,
  });

  private dielectricMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    roughness: 0.15,
    transmission: 0.6,
    ior: 1.5,
  });

  private fieldLineMaterial = new THREE.LineBasicMaterial({
    color: 0xfacc15, // Amarillo dorado
    transparent: true,
    opacity: 0.75,
  });

  private sparkMaterial = new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    linewidth: 2,
  });

  private topPlateMesh!: THREE.Mesh;
  private bottomPlateMesh!: THREE.Mesh;

  init(container: HTMLElement): void {
    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(3.2, -4.5, 3.2);
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
      // Fallback para entornos headless / jsdom
      return;
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 20;
    this.controls.minDistance = 1;

    // Iluminación
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 5, 8);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
    dirLight2.position.set(-5, -5, -4);
    this.scene.add(dirLight2);

    // Rejilla de referencia
    const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -1.2;
    this.scene.add(grid);

    // Inicializar geometrías de placas y dieléctrico
    this.buildBaseMeshes();
    this.scene.add(this.rootGroup);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  private buildBaseMeshes(): void {
    const defaultSize = 2.0; // Escala visual 3D
    const plateThickness = 0.08;

    // Placa superior (+)
    const plateGeom = new THREE.BoxGeometry(defaultSize, defaultSize, plateThickness);
    this.topPlateMesh = new THREE.Mesh(plateGeom, this.topPlateMaterial);
    this.topPlateGroup.add(this.topPlateMesh);

    // Placa inferior (-)
    this.bottomPlateMesh = new THREE.Mesh(plateGeom, this.bottomPlateMaterial);
    this.bottomPlateGroup.add(this.bottomPlateMesh);

    // Bloque dieléctrico
    const dielGeom = new THREE.BoxGeometry(defaultSize, defaultSize, 0.5);
    this.dielectricMesh = new THREE.Mesh(dielGeom, this.dielectricMaterial);

    this.rootGroup.add(this.topPlateGroup);
    this.rootGroup.add(this.bottomPlateGroup);
    this.rootGroup.add(this.dielectricMesh);
    this.rootGroup.add(this.fieldLinesGroup);
    this.rootGroup.add(this.arcDischargeGroup);
  }

  update(params: CapacitorVisualParams): void {
    if (!this.renderer) return;

    // 1. Escalamiento visual proporcional a los valores físicos
    // Normalizamos área física (0.005 m² a 0.04 m²) a escala 3D [1.2 a 2.8 unidades]
    const visualSize = Math.sqrt(params.areaM2) * 12.0;
    // Normalizamos separación física (1 mm a 20 mm) a escala 3D [0.3 a 1.8 unidades]
    const visualSeparation = Math.max(0.3, Math.min(params.separationM * 80.0, 1.8));
    const plateThickness = 0.08;

    // Actualizar placas
    this.topPlateMesh.scale.set(visualSize / 2.0, visualSize / 2.0, 1);
    this.bottomPlateMesh.scale.set(visualSize / 2.0, visualSize / 2.0, 1);

    this.topPlateGroup.position.set(0, 0, visualSeparation / 2 + plateThickness / 2);
    this.bottomPlateGroup.position.set(0, 0, -visualSeparation / 2 - plateThickness / 2);

    // 2. Actualizar Dieléctrico
    const insertion = params.insertion; // 0 = afuera, 1 = adentro
    this.dielectricMaterial.color.setHex(params.dielectric.colorHex);
    this.dielectricMesh.scale.set(
      visualSize / 2.0,
      visualSize / 2.0,
      visualSeparation / 0.5
    );

    // El dieléctrico se desliza sobre el eje X: cuando insertion=0, X = -visualSize; cuando insertion=1, X = 0
    const slideOffset = (1 - insertion) * visualSize;
    this.dielectricMesh.position.set(-slideOffset, 0, 0);
    this.dielectricMesh.visible = insertion > 0.01;

    // 3. Generar líneas de campo eléctrico entre placas
    this.rebuildFieldLines(visualSize, visualSeparation, params.voltageV);

    // 4. Efecto de ruptura dieléctrica / Chispazo eléctrico si ocurre breakdown
    this.rebuildDischargeArcs(visualSize, visualSeparation, params.calcResult.breakdownStatus);
  }

  private rebuildFieldLines(visualSize: number, visualSeparation: number, voltage: number): void {
    while (this.fieldLinesGroup.children.length > 0) {
      const child = this.fieldLinesGroup.children[0] as THREE.Line;
      this.fieldLinesGroup.remove(child);
      child.geometry.dispose();
    }

    if (Math.abs(voltage) < 1) return;

    const zTop = visualSeparation / 2;
    const zBottom = -visualSeparation / 2;
    const halfSize = visualSize / 2;
    const gridN = 5;
    const step = (visualSize * 0.85) / (gridN - 1);
    const startX = -(visualSize * 0.85) / 2;

    const isPositiveTop = voltage >= 0;
    const zFrom = isPositiveTop ? zTop : zBottom;
    const zTo = isPositiveTop ? zBottom : zTop;

    // Líneas uniformes interiores
    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        const x = startX + i * step;
        const y = startX + j * step;

        const points = [new THREE.Vector3(x, y, zFrom), new THREE.Vector3(x, y, zTo)];
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geom, this.fieldLineMaterial);
        this.fieldLinesGroup.add(line);
      }
    }

    // Líneas de borde curvadas hacia afuera (Fringing Field)
    const fringePointsCount = 8;
    const fringeD = (zTop - zBottom);
    for (let side = -1; side <= 1; side += 2) {
      const xBase = side * halfSize;
      const ptsLeft: THREE.Vector3[] = [];
      const ptsRight: THREE.Vector3[] = [];

      for (let k = 0; k <= fringePointsCount; k++) {
        const t = k / fringePointsCount;
        const z = zFrom + (zTo - zFrom) * t;
        // Curvatura parabólica hacia afuera
        const bulge = Math.sin(t * Math.PI) * fringeD * 0.35 * side;
        ptsLeft.push(new THREE.Vector3(xBase + bulge, 0, z));
      }

      const geom = new THREE.BufferGeometry().setFromPoints(ptsLeft);
      const line = new THREE.Line(geom, this.fieldLineMaterial);
      this.fieldLinesGroup.add(line);
    }
  }

  private rebuildDischargeArcs(visualSize: number, visualSeparation: number, status: string): void {
    while (this.arcDischargeGroup.children.length > 0) {
      const child = this.arcDischargeGroup.children[0] as THREE.Line;
      this.arcDischargeGroup.remove(child);
      child.geometry.dispose();
    }

    const isBreakdown =
      status === 'RUPTURA_AIRE' ||
      status === 'RUPTURA_DIELECTRICO' ||
      status === 'RUPTURA_TOTAL';

    if (!isBreakdown) return;

    // Generar 2 a 3 relámpagos/arcos voltaicos en zigzag aleatorio
    const numArcs = 3;
    const zTop = visualSeparation / 2;
    const zBottom = -visualSeparation / 2;
    const half = visualSize * 0.35;

    for (let a = 0; a < numArcs; a++) {
      const xStart = (Math.random() - 0.5) * half;
      const yStart = (Math.random() - 0.5) * half;
      const steps = 10;
      const arcPoints: THREE.Vector3[] = [new THREE.Vector3(xStart, yStart, zTop)];

      for (let s = 1; s < steps; s++) {
        const frac = s / steps;
        const z = zTop + (zBottom - zTop) * frac;
        const jitterX = xStart + (Math.random() - 0.5) * 0.25;
        const jitterY = yStart + (Math.random() - 0.5) * 0.25;
        arcPoints.push(new THREE.Vector3(jitterX, jitterY, z));
      }
      arcPoints.push(new THREE.Vector3(xStart, yStart, zBottom));

      const geom = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcLine = new THREE.Line(geom, this.sparkMaterial);
      this.arcDischargeGroup.add(arcLine);
    }
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

    // Rotación sutil del grupo para efecto 3D
    this.rootGroup.rotation.z += 0.001;

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
