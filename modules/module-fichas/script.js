// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

let pdfDoc = null;
let extractedText = '';
let detectedTables = [];
let currentFile = null;

const apiKeyInput = document.getElementById('apiKey');
const testApiBtn = document.getElementById('testApiBtn');
const apiStatus = document.getElementById('apiStatus');
const uploadBtn = document.getElementById('uploadBtn');
const pdfFileInput = document.getElementById('pdfFile');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const pageCount = document.getElementById('pageCount');
const extractBtn = document.getElementById('extractBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const extractedTextArea = document.getElementById('extractedText');
const statPages = document.getElementById('statPages');
const statChars = document.getElementById('statChars');
const statTables = document.getElementById('statTables');
const translateBtn = document.getElementById('translateBtn');
const translatedTextArea = document.getElementById('translatedText');
const copyTextBtn = document.getElementById('copyTextBtn');
const clearTextBtn = document.getElementById('clearTextBtn');
const copyAllTablesBtn = document.getElementById('copyAllTablesBtn');
const copyTranslationBtn = document.getElementById('copyTranslationBtn');
const tablesContainer = document.getElementById('tablesContainer');

const savedKey = localStorage.getItem('gemini_key');
if (savedKey) apiKeyInput.value = savedKey;

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('gemini_key', apiKeyInput.value.trim());
});

testApiBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Ingresa una API Key de Gemini');
        return;
    }
    
    updateApiStatus('probando', '🟡 Probando...');
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Responde solo 'OK'" }] }]
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        updateApiStatus('online', '✅ Conectado a Gemini');
    } catch (error) {
        updateApiStatus('offline', '❌ Error de conexión');
        alert('Error: ' + error.message);
    }
});

function updateApiStatus(status, text) {
    apiStatus.className = `status-badge status-${status}`;
    apiStatus.innerHTML = `<span>${status === 'online' ? '✅' : status === 'offline' ? '❌' : '🟡'}</span> ${text}`;
}

uploadBtn.addEventListener('click', () => pdfFileInput.click());

pdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    
    currentFile = file;
    fileName.textContent = file.name;
    
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pageCount.textContent = `${pdfDoc.numPages} págs`;
    fileInfo.style.display = 'block';
});

extractBtn.addEventListener('click', async () => {
    if (!pdfDoc) {
        alert('Primero selecciona un archivo PDF');
        return;
    }
    
    extractBtn.disabled = true;
    extractBtn.textContent = '⏳ Extrayendo...';
    progressContainer.style.display = 'block';
    
    let fullText = '';
    const numPages = pdfDoc.numPages;
    detectedTables = [];
    
    for (let i = 1; i <= numPages; i++) {
        const percent = (i / numPages) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Extrayendo página ${i} de ${numPages}...`;
        
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- PÁGINA ${i} ---\n${pageText}\n`;
        
        const tables = detectarTablasEnTexto(pageText);
        if (tables.length > 0) {
            tables.forEach(table => {
                detectedTables.push({
                    pagina: i,
                    contenido: table,
                    html: tablaAHtml(table)
                });
            });
        }
    }
    
    extractedText = fullText;
    extractedTextArea.value = extractedText;
    
    statPages.textContent = numPages;
    statChars.textContent = fullText.length.toLocaleString();
    statTables.textContent = detectedTables.length;
    
    mostrarTablas();
    
    extractBtn.disabled = false;
    extractBtn.textContent = '✅ Extraído correctamente';
    progressContainer.style.display = 'none';
    
    setTimeout(() => {
        extractBtn.textContent = '🔍 Extraer y analizar';
    }, 2000);
});

function detectarTablasEnTexto(texto) {
    const tablas = [];
    const lineas = texto.split('\n');
    let tablaActual = [];
    
    for (let linea of lineas) {
        if (linea.includes('|') || (linea.match(/\s{3,}/g) && linea.length > 30)) {
            tablaActual.push(linea);
        } else if (tablaActual.length >= 2 && linea.trim() === '') {
            if (tablaActual.length >= 2) tablas.push(tablaActual.join('\n'));
            tablaActual = [];
        } else if (tablaActual.length > 0 && linea.trim().length > 0 && !linea.includes('|')) {
            tablaActual.push(linea);
        }
    }
    if (tablaActual.length >= 2) tablas.push(tablaActual.join('\n'));
    
    const unicas = [];
    const contenidos = new Set();
    for (let t of tablas) {
        const key = t.substring(0, 100);
        if (!contenidos.has(key)) {
            contenidos.add(key);
            unicas.push(t);
        }
    }
    return unicas.slice(0, 20);
}

function tablaAHtml(textoTabla) {
    if (textoTabla.includes('|')) {
        let html = '<table style="width:100%; border-collapse:collapse;">';
        const lineas = textoTabla.split('\n');
        for (let linea of lineas) {
            if (linea.includes('|')) {
                const celdas = linea.split('|').filter(c => c.trim().length > 0);
                if (celdas.length > 0) {
                    html += '个';
                    for (let celda of celdas) {
                        html += `<td style="border:1px solid #ddd; padding:8px;">${escapeHtml(celda.trim())}</td>`;
                    }
                    html += '</tr>';
                }
            }
        }
        html += '</table>';
        return html;
    } else {
        return `<pre style="white-space:pre-wrap;">${escapeHtml(textoTabla)}</pre>`;
    }
}

function mostrarTablas() {
    if (detectedTables.length === 0) {
        tablesContainer.innerHTML = '<div class="empty-state"><span>📭</span><p>No se detectaron tablas en este documento</p></div>';
        return;
    }
    
    let html = '';
    detectedTables.forEach((table, idx) => {
        html += `
            <div class="table-item">
                <div class="table-header">
                    <span>📊 Tabla ${idx + 1} - Página ${table.pagina}</span>
                    <button onclick="copiarTabla(${idx})" class="btn-icon">📋 Copiar</button>
                </div>
                <div class="table-content">
                    ${table.html}
                </div>
            </div>
        `;
    });
    tablesContainer.innerHTML = html;
}

translateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) { alert('Configura tu API Key de Gemini'); return; }
    if (!extractedText) { alert('Primero extrae el texto de un PDF'); return; }
    
    translateBtn.disabled = true;
    translateBtn.textContent = '🔄 Traduciendo...';
    translatedTextArea.value = 'Traduciendo con IA...';
    
    try {
        const prompt = `Traduce al español técnico:\n\n${extractedText.substring(0, 6000)}`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        translatedTextArea.value = data.candidates[0].content.parts[0].text;
    } catch (error) {
        translatedTextArea.value = `Error: ${error.message}`;
        alert('Error: ' + error.message);
    } finally {
        translateBtn.disabled = false;
        translateBtn.textContent = '🔄 Traducir con IA';
    }
});

copyTextBtn.addEventListener('click', () => {
    if (extractedTextArea.value) { navigator.clipboard.writeText(extractedTextArea.value); alert('✅ Texto copiado'); }
});

copyTranslationBtn.addEventListener('click', () => {
    if (translatedTextArea.value && translatedTextArea.value !== 'Traduciendo con IA...') { navigator.clipboard.writeText(translatedTextArea.value); alert('✅ Traducción copiada'); }
});

copyAllTablesBtn.addEventListener('click', () => {
    if (detectedTables.length === 0) { alert('No hay tablas'); return; }
    let allTables = '';
    detectedTables.forEach((t, i) => { allTables += `--- TABLA ${i+1} (Pág ${t.pagina}) ---\n${t.contenido}\n\n`; });
    navigator.clipboard.writeText(allTables);
    alert(`✅ ${detectedTables.length} tablas copiadas`);
});

clearTextBtn.addEventListener('click', () => {
    extractedTextArea.value = '';
    translatedTextArea.value = '';
});

window.copiarTabla = (index) => {
    if (detectedTables[index]) { navigator.clipboard.writeText(detectedTables[index].contenido); alert(`✅ Tabla ${index+1} copiada`); }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
    });
});

console.log('Módulo de Fichas Técnicas cargado');
