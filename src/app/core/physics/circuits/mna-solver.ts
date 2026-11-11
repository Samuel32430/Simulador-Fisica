import { CircuitBranch, CircuitSolution, BranchResult } from './circuit-types';

/**
 * Solucionador de Circuitos Eléctricos mediante Análisis Nodal Modificado (MNA - Modified Nodal Analysis).
 * Utiliza eliminación gaussiana con pivoteo parcial para resolver el sistema lineal de ecuaciones
 * [G  B] [v]   [i]
 * [C  D] [j] = [e]
 * estándar en motores SPICE.
 */
export class MnaCircuitSolver {
  /**
   * Resuelve el circuito para una lista de ramas y un nodo de tierra especificado (por defecto '0').
   */
  solve(branches: CircuitBranch[], groundNode = '0'): CircuitSolution {
    // 1. Identificar todos los nodos únicos
    const nodeSet = new Set<string>();
    nodeSet.add(groundNode);

    for (const b of branches) {
      nodeSet.add(b.nodeFrom);
      nodeSet.add(b.nodeTo);
    }

    const allNodes = Array.from(nodeSet);
    // Filtrar el nodo de tierra para el sistema nodal
    const nonGroundNodes = allNodes.filter((n) => n !== groundNode);
    const n = nonGroundNodes.length;

    // Mapeo de nombre de nodo a índice de matriz (0 a n-1)
    const nodeIndexMap = new Map<string, number>();
    nonGroundNodes.forEach((node, idx) => nodeIndexMap.set(node, idx));

    // Identificar fuentes de voltaje independientes
    const voltageSources = branches.filter((b) => b.type === 'VOLTAGE_SOURCE');
    const m = voltageSources.length;

    // Dimensión total del sistema MNA: (n nodos) + (m fuentes)
    const dim = n + m;

    if (dim === 0) {
      return {
        nodeVoltages: { [groundNode]: 0 },
        branchResults: [],
        totalPowerSupplied: 0,
        totalPowerDissipated: 0,
      };
    }

    // Inicializar matriz A (dim x dim) y vector z (dim)
    const A: number[][] = Array.from({ length: dim }, () => Array(dim).fill(0));
    const z: number[] = Array(dim).fill(0);

    // 2. Estampar componentes pasivos (Resistores e Interruptores) en la submatriz G
    for (const b of branches) {
      let g = 0;

      if (b.type === 'RESISTOR') {
        const r = Math.max(b.value, 1e-6); // Evitar división por cero
        g = 1 / r;
      } else if (b.type === 'SWITCH') {
        // Interruptor abierto: conductancia despreciable (1e-10 S); cerrado: 1e5 S
        g = b.isOpen ? 1e-10 : 1e5;
      } else {
        continue;
      }

      const fromIdx = nodeIndexMap.get(b.nodeFrom);
      const toIdx = nodeIndexMap.get(b.nodeTo);

      if (fromIdx !== undefined) {
        A[fromIdx][fromIdx] += g;
      }
      if (toIdx !== undefined) {
        A[toIdx][toIdx] += g;
      }
      if (fromIdx !== undefined && toIdx !== undefined) {
        A[fromIdx][toIdx] -= g;
        A[toIdx][fromIdx] -= g;
      }
    }

    // 3. Estampar fuentes de voltaje en las submatrices B, C y el vector e
    voltageSources.forEach((src, sIdx) => {
      const row = n + sIdx;
      const col = n + sIdx;

      const fromIdx = nodeIndexMap.get(src.nodeFrom);
      const toIdx = nodeIndexMap.get(src.nodeTo);

      if (fromIdx !== undefined) {
        A[fromIdx][col] += 1;
        A[row][fromIdx] += 1;
      }
      if (toIdx !== undefined) {
        A[toIdx][col] -= 1;
        A[row][toIdx] -= 1;
      }

      // Valor de la fuente de tensión en el vector z
      z[row] = src.value;
    });

    // 4. Resolver el sistema lineal A * x = z mediante Eliminación Gaussiana con Pivoteo Parcial
    const x = this.solveLinearSystem(A, z);

    // 5. Construir mapa de potenciales nodales
    const nodeVoltages: Record<string, number> = { [groundNode]: 0 };
    nonGroundNodes.forEach((node, idx) => {
      nodeVoltages[node] = x[idx] || 0;
    });

    // 6. Calcular corrientes, caídas de potencial y potencias por rama
    const branchResults: BranchResult[] = [];
    let totalSupplied = 0;
    let totalDissipated = 0;

    voltageSources.forEach((src, sIdx) => {
      const vFrom = nodeVoltages[src.nodeFrom] ?? 0;
      const vTo = nodeVoltages[src.nodeTo] ?? 0;
      const vDrop = vFrom - vTo;

      // La corriente en MNA por convención fluye del terminal positivo (+) al negativo (-)
      const current = -(x[n + sIdx] || 0);
      const power = src.value * current;

      if (power > 0) totalSupplied += power;

      branchResults.push({
        branchId: src.id,
        type: 'VOLTAGE_SOURCE',
        label: src.label,
        voltageDrop: vDrop,
        current,
        power,
      });
    });

    for (const b of branches) {
      if (b.type === 'VOLTAGE_SOURCE') continue;

      const vFrom = nodeVoltages[b.nodeFrom] ?? 0;
      const vTo = nodeVoltages[b.nodeTo] ?? 0;
      const vDrop = vFrom - vTo;

      let current = 0;
      if (b.type === 'RESISTOR') {
        const r = Math.max(b.value, 1e-6);
        current = vDrop / r;
      } else if (b.type === 'SWITCH') {
        current = b.isOpen ? 0 : vDrop / 1e-5;
      }

      const power = Math.abs(vDrop * current);
      totalDissipated += power;

      branchResults.push({
        branchId: b.id,
        type: b.type,
        label: b.label,
        voltageDrop: vDrop,
        current,
        power,
      });
    }

    // Resistencia equivalente aproximada si hay al menos una fuente de voltaje principal
    let eqR: number | undefined;
    if (voltageSources.length === 1) {
      const mainSrc = branchResults.find((r) => r.type === 'VOLTAGE_SOURCE');
      if (mainSrc && Math.abs(mainSrc.current) > 1e-9) {
        eqR = Math.abs(mainSrc.voltageDrop / mainSrc.current);
      }
    }

    return {
      nodeVoltages,
      branchResults,
      totalPowerSupplied: totalSupplied,
      totalPowerDissipated: totalDissipated,
      equivalentResistance: eqR,
    };
  }

  /**
   * Resuelve Ax = b mediante descomposición/eliminación Gaussiana con pivoteo parcial.
   */
  private solveLinearSystem(A_in: number[][], b_in: number[]): number[] {
    const n = b_in.length;
    // Clonar para no mutar los originales
    const A = A_in.map((row) => [...row]);
    const b = [...b_in];

    // Eliminación hacia adelante con pivoteo parcial
    for (let i = 0; i < n; i++) {
      // Buscar fila con el pivote máximo en la columna i
      let maxRow = i;
      let maxVal = Math.abs(A[i][i]);

      for (let k = i + 1; k < n; k++) {
        const absVal = Math.abs(A[k][i]);
        if (absVal > maxVal) {
          maxVal = absVal;
          maxRow = k;
        }
      }

      // Intercambiar filas
      if (maxRow !== i) {
        const tempRow = A[i];
        A[i] = A[maxRow];
        A[maxRow] = tempRow;

        const tempB = b[i];
        b[i] = b[maxRow];
        b[maxRow] = tempB;
      }

      if (Math.abs(A[i][i]) < 1e-14) {
        // Singular o nodo flotante
        continue;
      }

      // Eliminar elementos debajo del pivote
      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / A[i][i];
        b[k] -= factor * b[i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }

    // Sustitución hacia atrás
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = Math.abs(A[i][i]) > 1e-14 ? sum / A[i][i] : 0;
    }

    return x;
  }
}
