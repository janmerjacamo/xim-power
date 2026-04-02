const CONTAINERS = {
    '20ft': { name: '20 ft Dry', L: 5.90, W: 2.35, H: 2.39, maxWeight: 28200 },
    '40ft': { name: '40 ft Dry', L: 12.03, W: 2.35, H: 2.39, maxWeight: 28800 },
    '20hc': { name: '20 ft High Cube', L: 5.90, W: 2.35, H: 2.69, maxWeight: 28200 },
    '40hc': { name: '40 ft High Cube', L: 12.03, W: 2.35, H: 2.69, maxWeight: 28800 }
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
    const orientation = document.getElementById('itemOrientation').value;
    
    if (!L || !W || !H || !qty || !weight) {
        showAlert('warning', 'Complete todas las dimensiones y peso');
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
        itemsBody.innerHTML = '像个<td colspan="5" style="text-align:center; padding:30px">No hay productos cargados</td><tr>';
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

function calculateDistribution() {
    const container = CONTAINERS[currentContainer];
    placements = [];
    
    // Ordenar por volumen descendente para mejor ajuste
    const sortedItems = [...items].sort((a, b) => (b.L * b.W * b.H) - (a.L * a.W * a.H));
    let currentX = 0, currentY = 0, currentZ = 0;
    let maxRowHeight = 0, currentRowWidth = 0;
    let layerHeight = 0;
    
    for (const item of sortedItems) {
        for (let q = 0; q < item.qty; q++) {
            // Orientación optimizada
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
            
            // Posicionamiento en capas
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
                layerHeight = 0;
            }
            
            if (currentZ + h > container.H + 0.01) {
                showAlert('warning', `⚠️ No hay espacio vertical para ${item.name}`);
                break;
            }
            
            // Guardar colocación
            placements.push({
                name: item.name,
                l, w, h,
                x: currentX, y: currentY, z: currentZ,
                color: `hsl(${(item.id * 47) % 360}, 70%, 55%)`,
                dimensions: `${dims.L}x${dims.W}x${dims.H} mm`
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
    
    if (occupancy > 95) showAlert('warning', '⚠️ Ocupación crítica >95%. Considere usar contenedor más grande');
    else if (weightPercent > 90) showAlert('warning', '⚠️ Peso cercano al límite máximo del contenedor');
    else if (placements.length > 0) showAlert('success', '✅ Distribución óptima calculada');
    
    drawPlot3D(placements, container);
}

function showAlert(type, message) {
    const icon = type === 'warning' ? 'exclamation-triangle' : 'check-circle';
    alertsContainer.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icon}"></i> ${message}</div>`;
    setTimeout(() => { alertsContainer.innerHTML = ''; }, 5000);
}

function drawPlot3D(placements, container) {
    const traces = [];
    
    // 1. Contenedor transparente (wireframe)
    const x = [0, container.L, container.L, 0, 0, container.L, container.L, 0];
    const y = [0, 0, container.W, container.W, 0, 0, container.W, container.W];
    const z = [0, 0, 0, 0, container.H, container.H, container.H, container.H];
    
    // Líneas del contenedor
    const edges = [
        [0,1], [1,2], [2,3], [3,0], // base
        [4,5], [5,6], [6,7], [7,4], // techo
        [0,4], [1,5], [2,6], [3,7]  // verticales
    ];
    
    edges.forEach(edge => {
        traces.push({
            type: 'scatter3d',
            mode: 'lines',
            x: [x[edge[0]], x[edge[1]]],
            y: [y[edge[0]], y[edge[1]]],
            z: [z[edge[0]], z[edge[1]]],
            line: { color: '#2C3E50', width: 4 },
            showlegend: false,
            hoverinfo: 'none'
        });
    });
    
    // 2. Cubos para cada producto (con volumen y transparencia)
    placements.forEach((p, idx) => {
        const x0 = p.x;
        const x1 = p.x + p.l;
        const y0 = p.y;
        const y1 = p.y + p.w;
        const z0 = p.z;
        const z1 = p.z + p.h;
        
        // Cubo sólido con opacidad
        traces.push({
            type: 'mesh3d',
            x: [x0, x1, x1, x0, x0, x1, x1, x0],
            y: [y0, y0, y1, y1, y0, y0, y1, y1],
            z: [z0, z0, z0, z0, z1, z1, z1, z1],
            opacity: 0.85,
            color: p.color,
            name: p.name,
            hoverinfo: 'text',
            text: `<b>${p.name}</b><br>Dimensiones: ${(p.l*1000).toFixed(0)} x ${(p.w*1000).toFixed(0)} x ${(p.h*1000).toFixed(0)} mm<br>Posición: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`,
            showlegend: false,
            lighting: { ambient: 0.8, diffuse: 0.6 }
        });
        
        // Bordes del cubo (para mejor visibilidad)
        const cubeEdges = [
            [0,1], [1,2], [2,3], [3,0],
            [4,5], [5,6], [6,7], [7,4],
            [0,4], [1,5], [2,6], [3,7]
        ];
        const cubeX = [x0, x1, x1, x0, x0, x1, x1, x0];
        const cubeY = [y0, y0, y1, y1, y0, y0, y1, y1];
        const cubeZ = [z0, z0, z0, z0, z1, z1, z1, z1];
        
        cubeEdges.forEach(edge => {
            traces.push({
                type: 'scatter3d',
                mode: 'lines',
                x: [cubeX[edge[0]], cubeX[edge[1]]],
                y: [cubeY[edge[0]], cubeY[edge[1]]],
                z: [cubeZ[edge[0]], cubeZ[edge[1]]],
                line: { color: '#000000', width: 2 },
                showlegend: false,
                hoverinfo: 'none'
            });
        });
        
        // Etiqueta con el nombre (solo para primeros 10 para no saturar)
        if (idx < 15) {
            traces.push({
                type: 'scatter3d',
                mode: 'text',
                x: [(x0 + x1) / 2],
                y: [(y0 + y1) / 2],
                z: [z1 + 0.03],
                text: [p.name.length > 12 ? p.name.substring(0,10)+'..' : p.name],
                textfont: { size: 9, color: '#1A2C3E', family: 'Inter' },
                showlegend: false,
                hoverinfo: 'none'
            });
        }
    });
    
    // Configuración de la cámara y vista
    const layout = {
        title: {
            text: `<b>${CONTAINERS[currentContainer].name}</b> - ${placements.length} unidades cargadas | Volumen: ${(placements.reduce((s,p)=>s+p.l*p.w*p.h,0)).toFixed(2)} m³`,
            font: { size: 14, color: '#1A2C3E' },
            x: 0.05,
            xanchor: 'left'
        },
        scene: {
            xaxis: {
                title: 'Largo (m)',
                range: [-0.1, container.L + 0.2],
                color: '#5A6874',
                gridcolor: '#E9ECEF'
            },
            yaxis: {
                title: 'Ancho (m)',
                range: [-0.1, container.W + 0.2],
                color: '#5A6874',
                gridcolor: '#E9ECEF'
            },
            zaxis: {
                title: 'Alto (m)',
                range: [-0.1, container.H + 0.2],
                color: '#5A6874',
                gridcolor: '#E9ECEF'
            },
            aspectmode: 'manual',
            aspectratio: { x: container.L, y: container.W, z: container.H },
            camera: {
                eye: { x: 2.2, y: 1.8, z: 1.5 },
                up: { x: 0, y: 0, z: 1 }
            },
            bgcolor: '#F8FAFC',
            annotations: []
        },
        margin: { l: 0, r: 0, b: 0, t: 50 },
        paper_bgcolor: '#F8FAFC',
        plot_bgcolor: '#F8FAFC',
        hoverlabel: { bgcolor: 'white', font: { size: 11, family: 'Inter' } }
    };
    
    Plotly.newPlot('plot', traces, layout, { responsive: true, displayModeBar: true });
}

resetViewBtn.addEventListener('click', () => {
    const container = CONTAINERS[currentContainer];
    Plotly.relayout('plot', {
        'scene.camera': { eye: { x: 2.2, y: 1.8, z: 1.5 } }
    });
});

// Capturar imagen y exportar PDF
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
        
        // Título
        pdf.setFontSize(18);
        pdf.setTextColor(4, 60, 124);
        pdf.text('XIM POWER - Reporte de Planificación de Carga', 20, 20);
        
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Proyecto: ${project} | Cliente: ${client} | Fecha: ${new Date().toLocaleString()}`, 20, 30);
        
        // Datos del contenedor
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Contenedor: ${container.name} (${container.L.toFixed(2)} x ${container.W.toFixed(2)} x ${container.H.toFixed(2)} m)`, 20, 42);
        pdf.text(`Capacidad máxima: ${container.maxWeight.toLocaleString()} kg`, 20, 49);
        
        // KPIs
        pdf.text(`Unidades: ${totalUnits.textContent} | Peso: ${totalWeight.textContent} kg | Volumen: ${totalVolume.textContent} m³`, 20, 59);
        pdf.text(`Ocupación volumétrica: ${occupancyRate.textContent} | Carga de peso: ${weightLoad.textContent}`, 20, 66);
        
        // Imagen 3D
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 20, 74, imgWidth, Math.min(imgHeight, 120));
        
        // Lista de productos
        let yPos = 74 + Math.min(imgHeight, 120) + 10;
        pdf.setFontSize(10);
        pdf.text('Productos cargados:', 20, yPos);
        yPos += 6;
        pdf.setFontSize(8);
        items.forEach((item, i) => {
            if (yPos > 190) { pdf.addPage(); yPos = 20; }
            pdf.text(`${i+1}. ${item.name}: ${item.qty} uds (${item.L}x${item.W}x${item.H} mm, ${item.weight} kg c/u)`, 20, yPos);
            yPos += 5;
        });
        
        // Resumen de colocaciones
        if (placements.length > 0 && yPos < 180) {
            yPos += 5;
            pdf.setFontSize(9);
            pdf.text('Resumen de colocaciones 3D:', 20, yPos);
            yPos += 5;
            pdf.setFontSize(7);
            placements.slice(0, 8).forEach((p, i) => {
                if (yPos > 260) return;
                pdf.text(`• ${p.name}: posición (${p.x.toFixed(1)}m, ${p.y.toFixed(1)}m, ${p.z.toFixed(1)}m)`, 20, yPos);
                yPos += 4;
            });
            if (placements.length > 8) {
                pdf.text(`... y ${placements.length - 8} unidades más`, 20, yPos);
            }
        }
        
        pdf.save(`carga_${project.replace(/\s/g, '_')}.pdf`);
        showAlert('success', '✅ PDF exportado correctamente');
    } catch (error) {
        console.error(error);
        showAlert('warning', 'Error al generar PDF');
    }
});

exportPdfBtn.addEventListener('click', () => {
    screenshotBtn.click();
});

clearAllBtn.addEventListener('click', () => {
    if (confirm('¿Eliminar todos los productos?')) {
        items = [];
        updateItemsTable();
        calculateDistribution();
    }
});

calculateBtn.addEventListener('click', calculateDistribution);
calculateDistribution();
window.removeItem = removeItem;
