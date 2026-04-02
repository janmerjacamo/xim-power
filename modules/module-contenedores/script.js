// ============================================================
// XIM POWER - CONTAINER LOAD PLANNER PROFESSIONAL
// Algoritmos de optimización de carga 3D
// Estándares: ISO 668, IMO, SOLAS, CTU Code
// ============================================================

// Tipos de mercancía con propiedades
const CARGO_TYPES = {
    'standard': { name: 'Estándar', maxStack: 5, fragile: false, density: 0.5, stowageFactor: 1.2 },
    'fragile': { name: 'Frágil', maxStack: 2, fragile: true, density: 0.3, stowageFactor: 1.5 },
    'heavy': { name: 'Pesado', maxStack: 3, fragile: false, density: 1.2, stowageFactor: 0.8 },
    'pallet': { name: 'Pallet', maxStack: 4, fragile: false, density: 0.6, stowageFactor: 1.1 },
    'liquid': { name: 'Líquido', maxStack: 3, fragile: true, density: 1.0, stowageFactor: 1.3 }
};

// Contenedores estándar ISO 668
const CONTAINERS = {
    '20ft': { 
        name: '20 ft Dry', L: 5.90, W: 2.35, H: 2.39, 
        maxWeight: 28200, tare: 2200, maxPayload: 26000,
        floorArea: 13.86, volume: 33.2,
        iso: 'ISO 668 1C',
        lashingPoints: 12
    },
    '40ft': { 
        name: '40 ft Dry', L: 12.03, W: 2.35, H: 2.39, 
        maxWeight: 28800, tare: 3800, maxPayload: 25000,
        floorArea: 28.27, volume: 67.6,
        iso: 'ISO 668 1A',
        lashingPoints: 24
    },
    '20hc': { 
        name: '20 ft High Cube', L: 5.90, W: 2.35, H: 2.69, 
        maxWeight: 28200, tare: 2300, maxPayload: 25900,
        floorArea: 13.86, volume: 37.4,
        iso: 'ISO 668 1C HC',
        lashingPoints: 12
    },
    '40hc': { 
        name: '40 ft High Cube', L: 12.03, W: 2.35, H: 2.69, 
        maxWeight: 28800, tare: 4000, maxPayload: 24800,
        floorArea: 28.27, volume: 76.3,
        iso: 'ISO 668 1A HC',
        lashingPoints: 24
    }
};

// Estado global
let items = [];
let placements = [];
let currentContainer = '40ft';
let optimizationMetrics = {
    centerOfGravity: { x: 0, y: 0, z: 0 },
    axleLoad: { front: 0, rear: 0 },
    stabilityIndex: 100,
    spaceEfficiency: 0,
    weightEfficiency: 0,
    recommendedLashing: 0
};

// Elementos DOM
const containerType = document.getElementById('containerType');
const addItemBtn = document.getElementById('addItemBtn');
const calculateBtn = document.getElementById('calculateBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const itemsBody = document.getElementById('itemsBody');
const totalUnits = document.getElementById('totalUnits');
const totalWeight = document.getElementById('totalWeight');
const totalVolume = document.getElementById('totalVolume');
const occupancyRate = document.getElementById('occupancyRate');
const weightLoad = document.getElementById('weightLoad');
const containerDims = document.getElementById('containerDims');
const alertsContainer = document.getElementById('alertsContainer');

// Agregar nuevos elementos para métricas avanzadas
const advancedMetricsDiv = document.createElement('div');
advancedMetricsDiv.className = 'card';
advancedMetricsDiv.style.marginTop = '16px';
advancedMetricsDiv.innerHTML = `
    <div class="card-header"><i class="fas fa-chart-line"></i><h3>Métricas de optimización</h3></div>
    <div class="card-body">
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-value" id="spaceEfficiency">0%</div><div class="kpi-label">Eficiencia espacial</div></div>
            <div class="kpi-card"><div class="kpi-value" id="stabilityIndex">100%</div><div class="kpi-label">Estabilidad</div></div>
            <div class="kpi-card"><div class="kpi-value" id="centerGravity">0,0,0</div><div class="kpi-label">Centro de gravedad</div></div>
        </div>
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-value" id="axleLoadFront">0 kg</div><div class="kpi-label">Eje delantero</div></div>
            <div class="kpi-card"><div class="kpi-value" id="axleLoadRear">0 kg</div><div class="kpi-label">Eje trasero</div></div>
            <div class="kpi-card"><div class="kpi-value" id="lashingPoints">0</div><div class="kpi-label">Puntos de amarre</div></div>
        </div>
        <div id="loadingSequenceContainer" style="margin-top:12px; font-size:11px; color:#5A6874;"></div>
    </div>
`;
document.querySelector('.main-grid .panel-left').appendChild(advancedMetricsDiv);

// Elementos de métricas
const spaceEfficiencyEl = document.getElementById('spaceEfficiency');
const stabilityIndexEl = document.getElementById('stabilityIndex');
const centerGravityEl = document.getElementById('centerGravity');
const axleLoadFrontEl = document.getElementById('axleLoadFront');
const axleLoadRearEl = document.getElementById('axleLoadRear');
const lashingPointsEl = document.getElementById('lashingPoints');
const loadingSequenceEl = document.getElementById('loadingSequenceContainer');

// ==================== ALGORITMOS DE OPTIMIZACIÓN ====================

// 1. Algoritmo de empaquetamiento 3D con First Fit Decreasing
function calculateOptimalPlacement(items, container) {
    const placements = [];
    const sortedItems = [...items].sort((a, b) => {
        // Orden por: volumen > peso > fragilidad (frágiles van arriba)
        const volA = a.L * a.W * a.H;
        const volB = b.L * b.W * b.H;
        if (volA !== volB) return volB - volA;
        if (a.weight !== b.weight) return b.weight - a.weight;
        return (a.cargoType === 'fragile' ? 1 : 0) - (b.cargoType === 'fragile' ? 1 : 0);
    });
    
    let currentX = 0, currentY = 0, currentZ = 0;
    let maxRowHeight = 0, currentRowWidth = 0;
    let currentLayer = 0;
    const stackCount = new Map();
    
    for (const item of sortedItems) {
        const cargoConfig = CARGO_TYPES[item.cargoType] || CARGO_TYPES.standard;
        const maxStack = cargoConfig.maxStack;
        
        for (let q = 0; q < item.qty; q++) {
            // Contador de apilamiento
            const stackKey = `${Math.floor(currentX*100)},${Math.floor(currentY*100)}`;
            const currentStack = stackCount.get(stackKey) || 0;
            
            if (currentStack >= maxStack) {
                // Buscar nueva posición si ya no se puede apilar más
                currentX = 0;
                currentY += currentRowWidth;
                currentRowWidth = 0;
                stackCount.clear();
            }
            
            // Optimización de orientación (6 posibles rotaciones)
            const orientations = getOptimalOrientation(item, container, currentX, currentY, currentZ);
            
            const l = orientations.L / 1000;
            const w = orientations.W / 1000;
            const h = orientations.H / 1000;
            
            // Posicionamiento con guillotine cut
            if (currentX + l > container.L + 0.01) {
                currentX = 0;
                currentY += currentRowWidth;
                currentRowWidth = 0;
            }
            
            if (currentY + w > container.W + 0.01) {
                currentX = 0;
                currentY = 0;
                currentZ += maxRowHeight;
                maxRowHeight = 0;
                currentLayer++;
            }
            
            if (currentZ + h > container.H + 0.01) {
                // No cabe más verticalmente
                break;
            }
            
            placements.push({
                id: item.id,
                name: item.name,
                l, w, h,
                x: currentX, y: currentY, z: currentZ,
                weight: item.weight,
                volume: l * w * h,
                cargoType: item.cargoType,
                color: getColorByType(item.cargoType),
                orientation: orientations
            });
            
            stackCount.set(stackKey, currentStack + 1);
            currentX += l;
            if (w > currentRowWidth) currentRowWidth = w;
            if (h > maxRowHeight) maxRowHeight = h;
        }
    }
    
    return placements;
}

// 2. Obtener mejor orientación (6 rotaciones posibles)
function getOptimalOrientation(item, container, currentX, currentY, currentZ) {
    const dims = [
        { L: item.L, W: item.W, H: item.H },
        { L: item.L, W: item.H, H: item.W },
        { L: item.W, W: item.L, H: item.H },
        { L: item.W, W: item.H, H: item.L },
        { L: item.H, W: item.L, H: item.W },
        { L: item.H, W: item.W, H: item.L }
    ];
    
    let bestOrient = dims[0];
    let bestScore = Infinity;
    
    for (const orient of dims) {
        const l = orient.L / 1000;
        const w = orient.W / 1000;
        const h = orient.H / 1000;
        
        if (l <= container.L && w <= container.W && h <= container.H) {
            // Score: minimizar desperdicio de espacio
            const wasteX = Math.abs(container.L - (currentX + l));
            const wasteY = Math.abs(container.W - (currentY + w));
            const wasteZ = Math.abs(container.H - (currentZ + h));
            const score = wasteX + wasteY + wasteZ;
            
            if (score < bestScore) {
                bestScore = score;
                bestOrient = orient;
            }
        }
    }
    
    return bestOrient;
}

// 3. Calcular centro de gravedad
function calculateCenterOfGravity(placements, container) {
    let totalMomentX = 0, totalMomentY = 0, totalMomentZ = 0;
    let totalWeight = 0;
    
    placements.forEach(p => {
        const weight = p.weight;
        const cx = p.x + p.l / 2;
        const cy = p.y + p.w / 2;
        const cz = p.z + p.h / 2;
        
        totalMomentX += weight * cx;
        totalMomentY += weight * cy;
        totalMomentZ += weight * cz;
        totalWeight += weight;
    });
    
    if (totalWeight === 0) return { x: container.L/2, y: container.W/2, z: container.H/2 };
    
    return {
        x: totalMomentX / totalWeight,
        y: totalMomentY / totalWeight,
        z: totalMomentZ / totalWeight
    };
}

// 4. Calcular carga por eje (camión)
function calculateAxleLoad(placements, container) {
    const truckWheelbase = 6.0; // metros entre ejes
    const containerOffset = 1.5; // offset del contenedor sobre el camión
    
    let totalMoment = 0;
    let totalWeight = 0;
    
    placements.forEach(p => {
        const posX = p.x + containerOffset;
        const weight = p.weight;
        totalMoment += weight * posX;
        totalWeight += weight;
    });
    
    const rearAxle = (totalMoment / truckWheelbase) * 0.6;
    const frontAxle = totalWeight - rearAxle;
    
    return { front: Math.max(0, frontAxle), rear: Math.max(0, rearAxle) };
}

// 5. Calcular índice de estabilidad
function calculateStabilityIndex(placements, container, centerGravity) {
    if (placements.length === 0) return 100;
    
    // Factores de estabilidad
    let stabilityScore = 100;
    
    // 1. Centro de gravedad muy alto = inestable
    const heightRatio = centerGravity.z / container.H;
    if (heightRatio > 0.6) stabilityScore -= (heightRatio - 0.6) * 50;
    
    // 2. Desbalance lateral
    const lateralBalance = Math.abs(centerGravity.y - container.W/2) / (container.W/2);
    stabilityScore -= lateralBalance * 30;
    
    // 3. Desbalance longitudinal
    const longBalance = Math.abs(centerGravity.x - container.L/2) / (container.L/2);
    stabilityScore -= longBalance * 20;
    
    return Math.max(0, Math.min(100, stabilityScore));
}

// 6. Calcular eficiencia espacial
function calculateSpaceEfficiency(placements, container) {
    const usedVolume = placements.reduce((sum, p) => sum + (p.l * p.w * p.h), 0);
    const containerVolume = container.L * container.W * container.H;
    return (usedVolume / containerVolume) * 100;
}

// 7. Generar secuencia de carga óptima
function generateLoadingSequence(placements) {
    // Orden por peso descendente (los más pesados abajo y primero)
    const sorted = [...placements].sort((a, b) => b.weight - a.weight);
    
    let sequence = [];
    let layer = 1;
    let currentZ = 0;
    
    sorted.forEach(p => {
        if (p.z > currentZ + 0.1) {
            layer++;
            currentZ = p.z;
        }
        sequence.push(`Capa ${layer}: ${p.name} (${(p.weight).toFixed(0)} kg) - posición (${p.x.toFixed(1)}m, ${p.y.toFixed(1)}m)`);
    });
    
    return sequence.slice(0, 12);
}

// 8. Recomendar puntos de amarre
function calculateLashingPoints(placements, container) {
    const totalWeight = placements.reduce((sum, p) => sum + p.weight, 0);
    const weightRatio = totalWeight / container.maxPayload;
    
    if (weightRatio > 0.8) return container.lashingPoints;
    if (weightRatio > 0.5) return Math.floor(container.lashingPoints * 0.7);
    return Math.floor(container.lashingPoints * 0.4);
}

// 9. Color por tipo de carga
function getColorByType(type) {
    const colors = {
        'standard': '#3065af',
        'fragile': '#f39200',
        'heavy': '#70b62c',
        'pallet': '#9c27b0',
        'liquid': '#00acc1'
    };
    return colors[type] || '#3065af';
}

// ==================== FUNCIONES PRINCIPALES ====================

containerType.addEventListener('change', () => {
    currentContainer = containerType.value;
    updateContainerDims();
    calculateDistribution();
});

function updateContainerDims() {
    const c = CONTAINERS[currentContainer];
    containerDims.textContent = `${c.L.toFixed(2)}x${c.W.toFixed(2)}x${c.H.toFixed(2)}`;
}
updateContainerDims();

addItemBtn.addEventListener('click', () => {
    const name = document.getElementById('productName').value.trim() || 'Producto';
    const L = parseFloat(document.getElementById('itemL').value);
    const W = parseFloat(document.getElementById('itemW').value);
    const H = parseFloat(document.getElementById('itemH').value);
    const qty = parseInt(document.getElementById('itemQty').value);
    const weight = parseFloat(document.getElementById('itemWeight').value);
    const cargoType = document.getElementById('itemOrientation')?.value || 'standard';
    
    if (!L || !W || !H || !qty || !weight) {
        showAlert('warning', 'Complete todas las dimensiones y peso');
        return;
    }
    
    items.push({
        id: items.length + 1,
        name, L, W, H, qty, weight,
        cargoType: cargoType,
        volume: (L * W * H * qty) / 1e9,
        cargoConfig: CARGO_TYPES[cargoType] || CARGO_TYPES.standard
    });
    
    updateItemsTable();
    calculateDistribution();
    
    document.getElementById('productName').value = '';
    document.getElementById('itemL').value = '600';
    document.getElementById('itemW').value = '400';
    document.getElementById('itemH').value = '500';
    document.getElementById('itemQty').value = '1';
    document.getElementById('itemWeight').value = '50';
});

function removeItem(index) {
    items.splice(index, 1);
    updateItemsTable();
    calculateDistribution();
}

function updateItemsTable() {
    if (items.length === 0) {
        itemsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px">No hay productos cargados</td></tr>';
        return;
    }
    
    itemsBody.innerHTML = items.map((item, idx) => `
        <tr>
            <td><strong>${item.name}</strong><br><small style="color:#7E8C9A">${CARGO_TYPES[item.cargoType]?.name || 'Estándar'}</small></td>
            <td>${item.L} x ${item.W} x ${item.H}</td>
            <td>${item.qty}</td>
            <td>${(item.weight * item.qty).toFixed(0)} kg</td>
            <td><button onclick="removeItem(${idx})" style="background:#FEF2F2; color:#DC2626; border:none; padding:4px 10px; border-radius:6px; cursor:pointer"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    const totalVol = items.reduce((sum, i) => sum + i.volume, 0);
    const totalW = items.reduce((sum, i) => sum + (i.weight * i.qty), 0);
    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
    
    totalUnits.textContent = totalQty;
    totalWeight.textContent = totalW.toFixed(0);
    totalVolume.textContent = totalVol.toFixed(2);
}

function calculateDistribution() {
    const container = CONTAINERS[currentContainer];
    
    // Expandir items por cantidad para el algoritmo
    const expandedItems = [];
    items.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            expandedItems.push({
                id: item.id,
                name: item.name,
                L: item.L, W: item.W, H: item.H,
                weight: item.weight,
                cargoType: item.cargoType
            });
        }
    });
    
    // Ejecutar algoritmo de optimización
    placements = calculateOptimalPlacement(expandedItems, container);
    
    // Calcular métricas
    const centerGravity = calculateCenterOfGravity(placements, container);
    const axleLoad = calculateAxleLoad(placements, container);
    const stability = calculateStabilityIndex(placements, container, centerGravity);
    const spaceEff = calculateSpaceEfficiency(placements, container);
    const lashing = calculateLashingPoints(placements, container);
    const loadingSeq = generateLoadingSequence(placements);
    
    // Actualizar métricas
    spaceEfficiencyEl.textContent = `${spaceEff.toFixed(1)}%`;
    stabilityIndexEl.textContent = `${stability.toFixed(0)}%`;
    centerGravityEl.textContent = `${centerGravity.x.toFixed(2)}, ${centerGravity.y.toFixed(2)}, ${centerGravity.z.toFixed(2)}`;
    axleLoadFrontEl.textContent = `${Math.round(axleLoad.front)} kg`;
    axleLoadRearEl.textContent = `${Math.round(axleLoad.rear)} kg`;
    lashingPointsEl.textContent = lashing;
    
    // Mostrar secuencia de carga
    if (loadingSeq.length > 0) {
        loadingSequenceEl.innerHTML = `
            <strong><i class="fas fa-list-ol"></i> Secuencia óptima de carga:</strong><br>
            ${loadingSeq.map(s => `• ${s}`).join('<br>')}
        `;
    } else {
        loadingSequenceEl.innerHTML = '';
    }
    
    // Estadísticas de peso y volumen
    const totalVol = placements.reduce((sum, p) => sum + p.volume, 0);
    const containerVol = container.L * container.W * container.H;
    const occupancy = (totalVol / containerVol) * 100;
    const weightTotal = placements.reduce((sum, p) => sum + p.weight, 0);
    const weightPercent = (weightTotal / container.maxPayload) * 100;
    
    occupancyRate.textContent = `${occupancy.toFixed(1)}%`;
    weightLoad.textContent = `${weightPercent.toFixed(1)}%`;
    
    // Alertas de optimización
    if (stability < 60) showAlert('warning', '⚠️ Estabilidad baja. Revisar distribución de peso');
    if (centerGravity.z > container.H * 0.7) showAlert('warning', '⚠️ Centro de gravedad muy alto. Riesgo de vuelco');
    if (Math.abs(centerGravity.y - container.W/2) > 0.3) showAlert('warning', '⚠️ Carga desbalanceada lateralmente');
    if (occupancy > 95) showAlert('warning', '⚠️ Ocupación crítica >95%');
    else if (weightPercent > 90) showAlert('warning', '⚠️ Peso cercano al límite máximo');
    else if (placements.length > 0) showAlert('success', '✅ Optimización completada. Distribución óptima');
    
    drawPlot3D(placements, container, centerGravity);
}

function showAlert(type, message) {
    const icon = type === 'warning' ? 'exclamation-triangle' : 'check-circle';
    alertsContainer.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icon}"></i> ${message}</div>`;
    setTimeout(() => { alertsContainer.innerHTML = ''; }, 6000);
}

function drawPlot3D(placements, container, centerGravity) {
    const traces = [];
    
    // Contenedor wireframe
    const x = [0, container.L, container.L, 0, 0, container.L, container.L, 0];
    const y = [0, 0, container.W, container.W, 0, 0, container.W, container.W];
    const z = [0, 0, 0, 0, container.H, container.H, container.H, container.H];
    
    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    edges.forEach(edge => {
        traces.push({
            type: 'scatter3d', mode: 'lines',
            x: [x[edge[0]], x[edge[1]]],
            y: [y[edge[0]], y[edge[1]]],
            z: [z[edge[0]], z[edge[1]]],
            line: { color: '#1E293B', width: 4 },
            showlegend: false
        });
    });
    
    // Cubos de productos
    placements.forEach((p, idx) => {
        const x0 = p.x, x1 = p.x + p.l;
        const y0 = p.y, y1 = p.y + p.w;
        const z0 = p.z, z1 = p.z + p.h;
        
        traces.push({
            type: 'mesh3d',
            x: [x0, x1, x1, x0, x0, x1, x1, x0],
            y: [y0, y0, y1, y1, y0, y0, y1, y1],
            z: [z0, z0, z0, z0, z1, z1, z1, z1],
            opacity: 0.85,
            color: p.color,
            name: p.name,
            hoverinfo: 'text',
            text: `<b>${p.name}</b><br>${(p.l*1000).toFixed(0)}x${(p.w*1000).toFixed(0)}x${(p.h*1000).toFixed(0)} mm<br>${p.weight} kg<br>Tipo: ${CARGO_TYPES[p.cargoType]?.name || 'Estándar'}`,
            showlegend: false
        });
    });
    
    // Marcador del centro de gravedad
    if (centerGravity) {
        traces.push({
            type: 'scatter3d', mode: 'markers+text',
            x: [centerGravity.x],
            y: [centerGravity.y],
            z: [centerGravity.z],
            marker: { size: 8, color: '#E6163E', symbol: 'circle' },
            text: ['CG'],
            textposition: 'top center',
            textfont: { size: 10, color: '#E6163E' },
            name: 'Centro de gravedad',
            showlegend: true
        });
    }
    
    const layout = {
        title: { text: `${container.name} - ${placements.length} unidades | Volumen: ${placements.reduce((s,p)=>s+p.volume,0).toFixed(2)} m³`, font: { size: 14 } },
        scene: {
            xaxis: { title: 'Largo (m)', range: [-0.1, container.L + 0.2] },
            yaxis: { title: 'Ancho (m)', range: [-0.1, container.W + 0.2] },
            zaxis: { title: 'Alto (m)', range: [-0.1, container.H + 0.2] },
            aspectmode: 'manual',
            aspectratio: { x: container.L, y: container.W, z: container.H },
            camera: { eye: { x: 2.2, y: 1.8, z: 1.5 } },
            bgcolor: '#F8FAFC'
        },
        margin: { l: 0, r: 0, b: 0, t: 50 },
        paper_bgcolor: '#F8FAFC'
    };
    
    Plotly.newPlot('plot', traces, layout, { responsive: true });
}

resetViewBtn.addEventListener('click', () => {
    Plotly.relayout('plot', { 'scene.camera': { eye: { x: 2.2, y: 1.8, z: 1.5 } } });
});

screenshotBtn.addEventListener('click', async () => {
    const plotElement = document.getElementById('plot');
    const container = CONTAINERS[currentContainer];
    const project = document.getElementById('projectName').value || 'Sin proyecto';
    const client = document.getElementById('clientName').value || 'Sin cliente';
    
    try {
        showAlert('success', '📸 Generando PDF...');
        const canvas = await html2canvas(plotElement, { scale: 2, backgroundColor: '#F8FAFC' });
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        
        pdf.setFontSize(16);
        pdf.setTextColor(4, 60, 124);
        pdf.text('XIM POWER - Reporte de Planificación de Carga', 20, 20);
        
        pdf.setFontSize(9);
        pdf.text(`Proyecto: ${project} | Cliente: ${client} | Fecha: ${new Date().toLocaleString()}`, 20, 30);
        pdf.text(`Contenedor: ${container.name} (${container.L.toFixed(2)}x${container.W.toFixed(2)}x${container.H.toFixed(2)} m)`, 20, 38);
        
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 20, 45, imgWidth, Math.min(imgHeight, 100));
        
        let yPos = 45 + Math.min(imgHeight, 100) + 15;
        pdf.setFontSize(10);
        pdf.text('Métricas de optimización:', 20, yPos);
        yPos += 6;
        pdf.setFontSize(8);
        pdf.text(`• Eficiencia espacial: ${spaceEfficiencyEl.textContent}`, 20, yPos);
        yPos += 5;
        pdf.text(`• Estabilidad: ${stabilityIndexEl.textContent}`, 20, yPos);
        yPos += 5;
        pdf.text(`• Centro de gravedad: ${centerGravityEl.textContent} m`, 20, yPos);
        yPos += 5;
        pdf.text(`• Carga por eje: delantero ${axleLoadFrontEl.textContent} / trasero ${axleLoadRearEl.textContent}`, 20, yPos);
        yPos += 8;
        
        pdf.text('Productos:', 20, yPos);
        yPos += 5;
        items.forEach((item, i) => {
            if (yPos > 190) { pdf.addPage(); yPos = 20; }
            pdf.text(`${i+1}. ${item.name}: ${item.qty} uds (${item.L}x${item.W}x${item.H} mm, ${item.weight} kg)`, 20, yPos);
            yPos += 5;
        });
        
        pdf.save(`carga_${project.replace(/\s/g, '_')}.pdf`);
        showAlert('success', '✅ PDF exportado');
    } catch (error) {
        showAlert('warning', 'Error al generar PDF');
    }
});

exportPdfBtn.addEventListener('click', () => screenshotBtn.click());
clearAllBtn.addEventListener('click', () => { if (confirm('¿Eliminar todos?')) { items = []; updateItemsTable(); calculateDistribution(); } });
calculateBtn.addEventListener('click', calculateDistribution);
calculateDistribution();
window.removeItem = removeItem;
