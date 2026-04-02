const CONTAINERS = {
    '20ft': { name: '20 ft Dry', L: 5.90, W: 2.35, H: 2.39, L_mm: 5900, W_mm: 2350, H_mm: 2390, maxWeight: 28200 },
    '40ft': { name: '40 ft Dry', L: 12.03, W: 2.35, H: 2.39, L_mm: 12030, W_mm: 2350, H_mm: 2390, maxWeight: 28800 },
    '20hc': { name: '20 ft High Cube', L: 5.90, W: 2.35, H: 2.69, L_mm: 5900, W_mm: 2350, H_mm: 2690, maxWeight: 28200 },
    '40hc': { name: '40 ft High Cube', L: 12.03, W: 2.35, H: 2.69, L_mm: 12030, W_mm: 2350, H_mm: 2690, maxWeight: 28800 }
};

let items = [];
let placements = [];
let currentContainer = '40ft';

// Elementos DOM
const containerType = document.getElementById('containerType');
const addItemBtn = document.getElementById('addItemBtn');
const calculateBtn = document.getElementById('calculateBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const exportReportBtn = document.getElementById('exportReportBtn');
const itemsBody = document.getElementById('itemsBody');
const totalUnits = document.getElementById('totalUnits');
const totalWeight = document.getElementById('totalWeight');
const totalVolume = document.getElementById('totalVolume');
const occupancyRate = document.getElementById('occupancyRate');
const weightLoad = document.getElementById('weightLoad');
const alertsContainer = document.getElementById('alertsContainer');

// Cambio de contenedor
containerType.addEventListener('change', () => {
    currentContainer = containerType.value;
    calculateDistribution();
});

// Agregar producto
addItemBtn.addEventListener('click', () => {
    const name = document.getElementById('productName').value.trim() || 'Producto';
    const L = parseFloat(document.getElementById('itemL').value);
    const W = parseFloat(document.getElementById('itemW').value);
    const H = parseFloat(document.getElementById('itemH').value);
    const qty = parseInt(document.getElementById('itemQty').value);
    const weight = parseFloat(document.getElementById('itemWeight').value);
    const orientation = document.getElementById('itemOrientation').value;
    
    if (!L || !W || !H || !qty || !weight) {
        alert('Complete todas las dimensiones y peso');
        return;
    }
    
    items.push({
        id: items.length + 1,
        name, L, W, H, qty, weight,
        orientation: orientation === 'auto',
        volume: (L * W * H * qty) / 1e9
    });
    
    updateItemsTable();
    calculateDistribution();
    
    // Limpiar campos
    document.getElementById('productName').value = '';
    document.getElementById('itemL').value = '600';
    document.getElementById('itemW').value = '400';
    document.getElementById('itemH').value = '500';
    document.getElementById('itemQty').value = '1';
    document.getElementById('itemWeight').value = '50';
});

// Eliminar producto
function removeItem(index) {
    items.splice(index, 1);
    updateItemsTable();
    calculateDistribution();
}

// Actualizar tabla
function updateItemsTable() {
    if (items.length === 0) {
        itemsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px">No hay productos cargados</td></tr>';
        return;
    }
    
    itemsBody.innerHTML = items.map((item, idx) => `
        <tr>
            <td><strong>${item.name}</strong></td>
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

// Calcular distribución 3D
function calculateDistribution() {
    const container = CONTAINERS[currentContainer];
    placements = [];
    
    // Ordenar por volumen descendente
    const sortedItems = [...items].sort((a, b) => (b.L * b.W * b.H) - (a.L * a.W * a.H));
    
    let currentX = 0, currentY = 0, currentZ = 0;
    let maxRowHeight = 0;
    let currentRowWidth = 0;
    
    for (const item of sortedItems) {
        for (let q = 0; q < item.qty; q++) {
            // Orientaciones posibles
            let dims = { L: item.L, W: item.W, H: item.H };
            
            if (item.orientation) {
                const orientations = [
                    { L: item.L, W: item.W, H: item.H },
                    { L: item.W, W: item.L, H: item.H },
                    { L: item.L, W: item.H, H: item.W },
                    { L: item.H, W: item.L, H: item.W },
                    { L: item.W, W: item.H, H: item.L },
                    { L: item.H, W: item.W, H: item.L }
                ];
                
                let bestOrient = orientations[0];
                let bestFit = Infinity;
                
                for (const o of orientations) {
                    const l_m = o.L / 1000;
                    const w_m = o.W / 1000;
                    const h_m = o.H / 1000;
                    
                    if (l_m <= container.L && w_m <= container.W && h_m <= container.H) {
                        const fit = Math.abs(container.L - currentX - l_m) + 
                                    Math.abs(container.W - currentY - w_m) + 
                                    Math.abs(container.H - currentZ - h_m);
                        if (fit < bestFit) {
                            bestFit = fit;
                            bestOrient = o;
                        }
                    }
                }
                dims = bestOrient;
            }
            
            const l = dims.L / 1000;
            const w = dims.W / 1000;
            const h = dims.H / 1000;
            
            // Posicionamiento
            if (currentX + l > container.L) {
                currentX = 0;
                currentY += currentRowWidth;
                currentRowWidth = 0;
            }
            
            if (currentY + w > container.W) {
                currentX = 0;
                currentY = 0;
                currentZ += maxRowHeight;
                maxRowHeight = 0;
            }
            
            if (currentZ + h > container.H) {
                showAlert('warning', `⚠️ No hay espacio vertical para ${item.name}`);
                break;
            }
            
            placements.push({
                name: item.name,
                l, w, h,
                x: currentX, y: currentY, z: currentZ,
                color: `hsl(${(item.id * 47) % 360}, 70%, 55%)`
            });
            
            currentX += l;
            if (w > currentRowWidth) currentRowWidth = w;
            if (h > maxRowHeight) maxRowHeight = h;
        }
    }
    
    // Actualizar estadísticas
    const totalVol = placements.reduce((sum, p) => sum + (p.l * p.w * p.h), 0);
    const containerVol = container.L * container.W * container.H;
    const occupancy = (totalVol / containerVol) * 100;
    const weightTotal = items.reduce((sum, i) => sum + (i.weight * i.qty), 0);
    const weightPercent = (weightTotal / container.maxWeight) * 100;
    
    occupancyRate.textContent = `${occupancy.toFixed(1)}%`;
    weightLoad.textContent = `${weightPercent.toFixed(1)}%`;
    
    if (occupancy > 95) showAlert('warning', '⚠️ Ocupación crítica >95%');
    else if (weightPercent > 90) showAlert('warning', '⚠️ Peso cercano al límite máximo');
    else if (placements.length > 0) showAlert('success', '✅ Distribución óptima calculada');
    
    drawPlot(placements, container);
}

function showAlert(type, message) {
    const icon = type === 'warning' ? 'exclamation-triangle' : 'check-circle';
    alertsContainer.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icon}"></i> ${message}</div>`;
    setTimeout(() => { alertsContainer.innerHTML = ''; }, 5000);
}

function drawPlot(placements, container) {
    const traces = [];
    
    // Contenedor wireframe
    const x = [0, container.L, container.L, 0, 0, container.L, container.L, 0];
    const y = [0, 0, container.W, container.W, 0, 0, container.W, container.W];
    const z = [0, 0, 0, 0, container.H, container.H, container.H, container.H];
    
    traces.push({
        type: 'scatter3d', mode: 'lines',
        x: [x[0], x[1], x[2], x[3], x[0], x[4], x[5], x[6], x[7], x[4]],
        y: [y[0], y[1], y[2], y[3], y[0], y[4], y[5], y[6], y[7], y[4]],
        z: [z[0], z[1], z[2], z[3], z[0], z[4], z[5], z[6], z[7], z[4]],
        line: { color: '#1E293B', width: 3 },
        name: 'Contenedor',
        showlegend: true
    });
    
    // Cajas de productos
    placements.forEach(p => {
        const x0 = p.x, x1 = p.x + p.l;
        const y0 = p.y, y1 = p.y + p.w;
        const z0 = p.z, z1 = p.z + p.h;
        
        traces.push({
            type: 'mesh3d',
            x: [x0, x1, x1, x0, x0, x1, x1, x0],
            y: [y0, y0, y1, y1, y0, y0, y1, y1],
            z: [z0, z0, z0, z0, z1, z1, z1, z1],
            opacity: 0.75,
            color: p.color,
            name: p.name,
            hoverinfo: 'text',
            text: `${p.name}<br>${(p.l*1000).toFixed(0)} x ${(p.w*1000).toFixed(0)} x ${(p.h*1000).toFixed(0)} mm`
        });
    });
    
    const layout = {
        scene: {
            xaxis: { title: 'Largo (m)', range: [0, container.L + 0.2] },
            yaxis: { title: 'Ancho (m)', range: [0, container.W + 0.2] },
            zaxis: { title: 'Alto (m)', range: [0, container.H + 0.2] },
            aspectmode: 'manual',
            aspectratio: { x: container.L, y: container.W, z: container.H },
            camera: { eye: { x: 1.8, y: 1.5, z: 1.2 } }
        },
        margin: { l: 0, r: 0, b: 0, t: 30 },
        title: { text: `${container.name} - ${placements.length} unidades cargadas`, font: { size: 14 } }
    };
    
    Plotly.newPlot('plot', traces, layout, { responsive: true });
}

// Reset view
resetViewBtn.addEventListener('click', () => {
    Plotly.relayout('plot', { 'scene.camera': { eye: { x: 1.8, y: 1.5, z: 1.2 } } });
});

// Exportar reporte
exportReportBtn.addEventListener('click', () => {
    const container = CONTAINERS[currentContainer];
    const project = document.getElementById('projectName').value || 'Sin proyecto';
    const client = document.getElementById('clientName').value || 'Sin cliente';
    
    let report = `=== XIM POWER - REPORTE DE CARGA ===\n\n`;
    report += `Proyecto: ${project}\n`;
    report += `Cliente: ${client}\n`;
    report += `Contenedor: ${container.name}\n`;
    report += `Fecha: ${new Date().toLocaleString()}\n\n`;
    report += `--- PRODUCTOS CARGADOS ---\n`;
    items.forEach(item => {
        report += `${item.name}: ${item.qty} unidades (${item.L}x${item.W}x${item.H} mm, ${item.weight} kg c/u)\n`;
    });
    report += `\n--- RESUMEN ---\n`;
    report += `Total unidades: ${totalUnits.textContent}\n`;
    report += `Peso total: ${totalWeight.textContent} kg / ${container.maxWeight} kg (${weightLoad.textContent})\n`;
    report += `Volumen ocupado: ${totalVolume.textContent} m³ / ${(container.L*container.W*container.H).toFixed(2)} m³ (${occupancyRate.textContent})\n`;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carga_${project.replace(/\s/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('success', '✅ Reporte exportado');
});

// Limpiar todo
clearAllBtn.addEventListener('click', () => {
    if (confirm('¿Eliminar todos los productos?')) {
        items = [];
        updateItemsTable();
        calculateDistribution();
    }
});

// Calcular
calculateBtn.addEventListener('click', calculateDistribution);

// Inicializar
calculateDistribution();

// Exponer removeItem globalmente
window.removeItem = removeItem;
