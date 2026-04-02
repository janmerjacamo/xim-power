// Contenedores ISO
const CONTAINERS = {
    '20ft': { name: '20 ft Dry', L: 5.90, W: 2.35, H: 2.39, maxWeight: 28200 },
    '40ft': { name: '40 ft Dry', L: 12.03, W: 2.35, H: 2.39, maxWeight: 28800 },
    '20hc': { name: '20 ft High Cube', L: 5.90, W: 2.35, H: 2.69, maxWeight: 28200 },
    '40hc': { name: '40 ft High Cube', L: 12.03, W: 2.35, H: 2.69, maxWeight: 28800 }
};

// Colores por tipo
const COLORS = {
    'standard': '#3065af',
    'fragile': '#f39200',
    'heavy': '#70b62c'
};

let items = [];
let placements = [];
let currentContainer = '40ft';

// Elementos
const containerSelect = document.getElementById('containerType');
const addBtn = document.getElementById('addBtn');
const calcBtn = document.getElementById('calcBtn');
const clearBtn = document.getElementById('clearBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const itemsBody = document.getElementById('itemsBody');
const totalUnitsSpan = document.getElementById('totalUnits');
const totalWeightSpan = document.getElementById('totalWeight');
const totalVolumeSpan = document.getElementById('totalVolume');
const occupancySpan = document.getElementById('occupancy');
const weightPctSpan = document.getElementById('weightPct');
const alertMsg = document.getElementById('alertMsg');

// Cambio de contenedor
containerSelect.addEventListener('change', () => {
    currentContainer = containerSelect.value;
    calculateAndDraw();
});

// Agregar producto
addBtn.addEventListener('click', () => {
    const name = document.getElementById('productName').value.trim() || 'Producto';
    const L = parseFloat(document.getElementById('itemL').value);
    const W = parseFloat(document.getElementById('itemW').value);
    const H = parseFloat(document.getElementById('itemH').value);
    const qty = parseInt(document.getElementById('itemQty').value);
    const weight = parseFloat(document.getElementById('itemWeight').value);
    const type = document.getElementById('itemType').value;
    
    if (!L || !W || !H || !qty || !weight) {
        showAlert('Complete todos los campos', 'warning');
        return;
    }
    
    items.push({
        id: items.length + 1,
        name, L, W, H, qty, weight, type,
        volume: (L * W * H * qty) / 1e9
    });
    
    updateTable();
    calculateAndDraw();
    
    document.getElementById('productName').value = '';
    document.getElementById('itemL').value = '600';
    document.getElementById('itemW').value = '400';
    document.getElementById('itemH').value = '500';
    document.getElementById('itemQty').value = '1';
    document.getElementById('itemWeight').value = '50';
});

function removeItem(index) {
    items.splice(index, 1);
    updateTable();
    calculateAndDraw();
}

function updateTable() {
    if (items.length === 0) {
        itemsBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay productos</td></tr>';
        return;
    }
    
    itemsBody.innerHTML = items.map((item, idx) => `
        <tr>
            <td><strong>${item.name}</strong><br><small style="color:#7E8C9A">${item.type}</small></td>
            <td>${item.L}x${item.W}x${item.H}</td>
            <td>${item.qty}</td>
            <td>${(item.weight * item.qty).toFixed(0)} kg</td>
            <td><button onclick="removeItem(${idx})" style="background:#FEF2F2; border:none; padding:4px 8px; border-radius:6px; cursor:pointer"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    const totalVol = items.reduce((s, i) => s + i.volume, 0);
    const totalW = items.reduce((s, i) => s + (i.weight * i.qty), 0);
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    
    totalUnitsSpan.textContent = totalQty;
    totalWeightSpan.textContent = totalW.toFixed(0);
    totalVolumeSpan.textContent = totalVol.toFixed(2);
}

// Algoritmo de colocación 3D
function calculatePlacements() {
    const container = CONTAINERS[currentContainer];
    const placements = [];
    
    // Expandir items
    const expanded = [];
    items.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            expanded.push({
                id: item.id,
                name: item.name,
                L: item.L, W: item.W, H: item.H,
                weight: item.weight,
                type: item.type
            });
        }
    });
    
    // Ordenar por volumen descendente
    expanded.sort((a, b) => (b.L * b.W * b.H) - (a.L * a.W * a.H));
    
    let x = 0, y = 0, z = 0;
    let rowHeight = 0, rowWidth = 0;
    
    for (const item of expanded) {
        // Probar las 6 orientaciones
        const dims = [
            { L: item.L, W: item.W, H: item.H },
            { L: item.L, W: item.H, H: item.W },
            { L: item.W, W: item.L, H: item.H },
            { L: item.W, W: item.H, H: item.L },
            { L: item.H, W: item.L, H: item.W },
            { L: item.H, W: item.W, H: item.L }
        ];
        
        let bestDims = dims[0];
        let bestFit = Infinity;
        
        for (const d of dims) {
            const l = d.L / 1000;
            const w = d.W / 1000;
            const h = d.H / 1000;
            
            if (l <= container.L && w <= container.W && h <= container.H) {
                const waste = Math.abs(container.L - (x + l)) + Math.abs(container.W - (y + w)) + Math.abs(container.H - (z + h));
                if (waste < bestFit) {
                    bestFit = waste;
                    bestDims = d;
                }
            }
        }
        
        const l = bestDims.L / 1000;
        const w = bestDims.W / 1000;
        const h = bestDims.H / 1000;
        
        // Posicionamiento
        if (x + l > container.L) {
            x = 0;
            y += rowWidth;
            rowWidth = 0;
        }
        
        if (y + w > container.W) {
            x = 0;
            y = 0;
            z += rowHeight;
            rowHeight = 0;
        }
        
        if (z + h > container.H) {
            continue;
        }
        
        placements.push({
            name: item.name,
            l, w, h,
            x, y, z,
            weight: item.weight,
            type: item.type,
            color: COLORS[item.type] || '#3065af'
        });
        
        x += l;
        if (w > rowWidth) rowWidth = w;
        if (h > rowHeight) rowHeight = h;
    }
    
    return placements;
}

// Dibujar gráfico 3D
function draw3D(placements, container) {
    const traces = [];
    
    // Contenedor (wireframe)
    const cx = [0, container.L, container.L, 0, 0, container.L, container.L, 0];
    const cy = [0, 0, container.W, container.W, 0, 0, container.W, container.W];
    const cz = [0, 0, 0, 0, container.H, container.H, container.H, container.H];
    
    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    edges.forEach(edge => {
        traces.push({
            type: 'scatter3d',
            mode: 'lines',
            x: [cx[edge[0]], cx[edge[1]]],
            y: [cy[edge[0]], cy[edge[1]]],
            z: [cz[edge[0]], cz[edge[1]]],
            line: { color: '#1E293B', width: 3 },
            showlegend: false
        });
    });
    
    // Cubos de productos
    placements.forEach(p => {
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
            text: `${p.name}<br>${(p.l*1000).toFixed(0)}x${(p.w*1000).toFixed(0)}x${(p.h*1000).toFixed(0)} mm<br>${p.weight} kg`,
            showlegend: false
        });
        
        // Bordes
        const cubeEdges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
        const cubeX = [x0, x1, x1, x0, x0, x1, x1, x0];
        const cubeY = [y0, y0, y1, y1, y0, y0, y1, y1];
        const cubeZ = [z0, z0, z0, z0, z1, z1, z1, z1];
        cubeEdges.forEach(edge => {
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: [cubeX[edge[0]], cubeX[edge[1]]],
                y: [cubeY[edge[0]], cubeY[edge[1]]],
                z: [cubeZ[edge[0]], cubeZ[edge[1]]],
                line: { color: '#000000', width: 1.5 },
                showlegend: false
            });
        });
    });
    
    const layout = {
        scene: {
            xaxis: { title: 'Largo (m)', range: [-0.1, container.L + 0.2] },
            yaxis: { title: 'Ancho (m)', range: [-0.1, container.W + 0.2] },
            zaxis: { title: 'Alto (m)', range: [-0.1, container.H + 0.2] },
            aspectmode: 'manual',
            aspectratio: { x: container.L, y: container.W, z: container.H },
            camera: { eye: { x: 2.2, y: 1.8, z: 1.5 } },
            bgcolor: '#F8FAFC'
        },
        margin: { l: 0, r: 0, b: 0, t: 30 },
        paper_bgcolor: '#F8FAFC'
    };
    
    Plotly.newPlot('plot', traces, layout, { responsive: true });
}

function calculateAndDraw() {
    const container = CONTAINERS[currentContainer];
    placements = calculatePlacements();
    
    // Estadísticas
    const totalVol = placements.reduce((s, p) => s + (p.l * p.w * p.h), 0);
    const containerVol = container.L * container.W * container.H;
    const occupancy = (totalVol / containerVol) * 100;
    const totalWeight = placements.reduce((s, p) => s + p.weight, 0);
    const weightPct = (totalWeight / container.maxWeight) * 100;
    
    occupancySpan.textContent = `${occupancy.toFixed(1)}%`;
    weightPctSpan.textContent = `${weightPct.toFixed(1)}%`;
    
    if (occupancy > 95) showAlert('Ocupación crítica >95%', 'warning');
    else if (weightPct > 90) showAlert('Peso cercano al límite', 'warning');
    else if (placements.length > 0) showAlert('Distribución calculada correctamente', 'success');
    
    draw3D(placements, container);
}

function showAlert(msg, type) {
    const icon = type === 'warning' ? 'exclamation-triangle' : 'check-circle';
    alertMsg.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icon}"></i> ${msg}</div>`;
    setTimeout(() => { alertMsg.innerHTML = ''; }, 4000);
}

resetViewBtn.addEventListener('click', () => {
    const container = CONTAINERS[currentContainer];
    Plotly.relayout('plot', { 'scene.camera': { eye: { x: 2.2, y: 1.8, z: 1.5 } } });
});

calcBtn.addEventListener('click', calculateAndDraw);
clearBtn.addEventListener('click', () => {
    if (confirm('¿Eliminar todos los productos?')) {
        items = [];
        updateTable();
        calculateAndDraw();
    }
});

// Inicializar
calculateAndDraw();
window.removeItem = removeItem;
