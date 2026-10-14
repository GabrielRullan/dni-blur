/**
 * ProtegeDNI — Anonimizador de DNI Español (100% En el cliente / On-device)
 * Garantiza privacidad total: no sube nada a ningún servidor.
 */

// Application State
const state = {
  img: null, // HTMLImageElement loaded
  imgOrientation: 0, // 0, 90, 180, 270 degrees
  // Boxes: { id, x, y, width, height, label, style: 'pixelate'|'blur'|'blackout' } (stored in 0..1 normalized coordinates)
  boxes: [],
  selectedBoxId: null,
  activeStyle: 'pixelate',
  intensity: 18,
  
  // B&W options
  bwEnabled: true,
  contrast: 115,
  brightness: 100,

  // Watermark options
  wmEnabled: true,
  wmText: 'COPIA VÁLIDA SOLO PARA VERIFICACIÓN',
  wmIncludeDate: true,
  wmMode: 'tiled', // 'tiled', 'single', 'banner'
  wmColor: '#d92626',
  wmOpacity: 38,
  wmScale: 100,

  // View state
  showGuides: true,
  interaction: {
    mode: 'idle', // 'idle' | 'drawing' | 'moving' | 'resizing'
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    resizeHandle: null, // 'nw', 'ne', 'se', 'sw'
    activeBox: null,
    dragOffset: { x: 0, y: 0 }
  }
};

// DOM References
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const emptyState = document.getElementById('empty-state');
const canvasWrapper = document.getElementById('canvas-wrapper');
const canvas = document.getElementById('dni-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Buttons & controls
const btnRotate = document.getElementById('btn-rotate');
const btnDemoFront = document.getElementById('btn-demo-front');
const btnDemoBack = document.getElementById('btn-demo-back');
const btnEmptyDemo = document.getElementById('btn-empty-demo');
const btnClearBoxes = document.getElementById('btn-clear-boxes');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const btnRecommendAEPD = document.getElementById('btn-recommend-aepd');
const btnDownload = document.getElementById('btn-download');
const btnCopyClipboard = document.getElementById('btn-copy-clipboard');
const boxCountBadge = document.getElementById('box-count-badge');
const showGuidesCheckbox = document.getElementById('show-guides');

// Sliders & value badges
const redactIntensity = document.getElementById('redact-intensity');
const intensityVal = document.getElementById('intensity-val');
const bwEnabled = document.getElementById('bw-enabled');
const bwControls = document.getElementById('bw-controls');
const bwContrast = document.getElementById('bw-contrast');
const contrastVal = document.getElementById('contrast-val');
const bwBrightness = document.getElementById('bw-brightness');
const brightnessVal = document.getElementById('brightness-val');

// Watermark inputs
const wmEnabled = document.getElementById('wm-enabled');
const wmControls = document.getElementById('wm-controls');
const wmTextInput = document.getElementById('wm-text');
const wmIncludeDate = document.getElementById('wm-include-date');
const currentDatePreview = document.getElementById('current-date-preview');
const wmOpacity = document.getElementById('wm-opacity');
const opacityVal = document.getElementById('opacity-val');
const wmSize = document.getElementById('wm-size');
const sizeVal = document.getElementById('size-val');
const exportFormat = document.getElementById('export-format');

// Tab toggles for front/back presets
const presetTabs = document.querySelectorAll('[data-preset-tab]');
const presetsFront = document.getElementById('presets-front');
const presetsBack = document.getElementById('presets-back');

// Format current date in Spanish (e.g., "14/10/2026")
const todayStr = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
}).format(new Date());
if (currentDatePreview) {
  currentDatePreview.textContent = todayStr;
}

// Preset definitions (Normalized bounding boxes 0..1 based on standard Spanish DNI 3.0 / 4.0 layout)
const PRESETS = {
  // Front of DNI
  firma: { x: 0.28, y: 0.68, width: 0.32, height: 0.19, label: 'Firma' },
  can: { x: 0.81, y: 0.83, width: 0.16, height: 0.12, label: 'Código CAN' },
  soporte: { x: 0.65, y: 0.11, width: 0.30, height: 0.11, label: 'Nº Soporte' },
  validez: { x: 0.50, y: 0.55, width: 0.26, height: 0.11, label: 'Validez' },
  nacimiento: { x: 0.50, y: 0.44, width: 0.26, height: 0.09, label: 'Fecha Nac.' },
  foto_extra: { x: 0.80, y: 0.54, width: 0.16, height: 0.24, label: 'Foto sec.' },
  
  // Back of DNI
  mrz: { x: 0.03, y: 0.64, width: 0.94, height: 0.33, label: 'MRZ (Lectura)' },
  domicilio: { x: 0.05, y: 0.22, width: 0.90, height: 0.23, label: 'Domicilio' },
  padres: { x: 0.05, y: 0.11, width: 0.52, height: 0.10, label: 'Nombre Padres' },
  lugar_nac: { x: 0.05, y: 0.02, width: 0.70, height: 0.09, label: 'Lugar Nac.' }
};

// --- INITIALIZATION & EVENT LISTENERS ---
function init() {
  setupFileUpload();
  setupCanvasEvents();
  setupControls();
  setupDemos();
}

function setupFileUpload() {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
  });

  // Drag and drop into viewport
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) {
      loadFile(dt.files[0]);
    }
  });

  // Paste from clipboard support
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        loadFile(file);
        break;
      }
    }
  });
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Por favor selecciona un archivo de imagen válido.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.imgOrientation = 0;
      state.boxes = [];
      state.selectedBoxId = null;
      updateExportButtons(true);
      emptyState.classList.add('hidden');
      canvasWrapper.classList.remove('hidden');
      render();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function setupControls() {
  // Redaction style buttons
  document.querySelectorAll('[data-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-style]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeStyle = btn.dataset.style;
      if (state.selectedBoxId) {
        const b = state.boxes.find(x => x.id === state.selectedBoxId);
        if (b) b.style = state.activeStyle;
      }
      render();
    });
  });

  // Intensity slider
  redactIntensity.addEventListener('input', (e) => {
    state.intensity = parseInt(e.target.value, 10);
    const v = state.intensity;
    intensityVal.textContent = v < 14 ? 'Baja' : v > 26 ? 'Alta' : 'Media';
    render();
  });

  // Preset tabs
  presetTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      presetTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.presetTab;
      if (target === 'front') {
        presetsFront.classList.remove('hidden');
        presetsBack.classList.add('hidden');
      } else {
        presetsFront.classList.add('hidden');
        presetsBack.classList.remove('hidden');
      }
    });
  });

  // Preset chips
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset;
      const def = PRESETS[key];
      if (!def) return;
      if (!state.img) {
        alert('Carga primero una imagen o usa una demo para aplicar plantillas.');
        return;
      }
      addPresetBox(def);
    });
  });

  // Recommended button (AEPD & Police recommended: Signature + CAN + Support #)
  btnRecommendAEPD.addEventListener('click', () => {
    if (!state.img) {
      alert('Carga primero una imagen de DNI.');
      return;
    }
    // Add Signature, CAN and Support #
    ['soporte', 'firma', 'can'].forEach(k => {
      if (PRESETS[k]) addPresetBox(PRESETS[k]);
    });
  });

  // Delete selected box
  btnDeleteSelected.addEventListener('click', () => {
    deleteSelectedBox();
  });

  // Clear all boxes
  btnClearBoxes.addEventListener('click', () => {
    if (state.boxes.length === 0) return;
    if (confirm('¿Eliminar todas las zonas ocultas?')) {
      state.boxes = [];
      state.selectedBoxId = null;
      btnDeleteSelected.disabled = true;
      updateBoxBadge();
      render();
    }
  });

  // B&W Toggle & sliders
  bwEnabled.addEventListener('change', (e) => {
    state.bwEnabled = e.target.checked;
    bwControls.style.opacity = state.bwEnabled ? '1' : '0.4';
    bwControls.style.pointerEvents = state.bwEnabled ? 'all' : 'none';
    render();
  });

  bwContrast.addEventListener('input', (e) => {
    state.contrast = parseInt(e.target.value, 10);
    contrastVal.textContent = state.contrast + '%';
    render();
  });

  bwBrightness.addEventListener('input', (e) => {
    state.brightness = parseInt(e.target.value, 10);
    brightnessVal.textContent = state.brightness + '%';
    render();
  });

  // Watermark controls
  wmEnabled.addEventListener('change', (e) => {
    state.wmEnabled = e.target.checked;
    wmControls.style.opacity = state.wmEnabled ? '1' : '0.4';
    wmControls.style.pointerEvents = state.wmEnabled ? 'all' : 'none';
    render();
  });

  wmTextInput.addEventListener('input', (e) => {
    state.wmText = e.target.value;
    render();
  });

  wmIncludeDate.addEventListener('change', (e) => {
    state.wmIncludeDate = e.target.checked;
    render();
  });

  // Quick tags
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.wmText = btn.dataset.text;
      wmTextInput.value = state.wmText;
      render();
    });
  });

  // Watermark arrangement modes
  document.querySelectorAll('[data-wm-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-wm-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.wmMode = btn.dataset.wmMode;
      render();
    });
  });

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.wmColor = btn.dataset.color;
      render();
    });
  });

  wmOpacity.addEventListener('input', (e) => {
    state.wmOpacity = parseInt(e.target.value, 10);
    opacityVal.textContent = state.wmOpacity + '%';
    render();
  });

  wmSize.addEventListener('input', (e) => {
    state.wmScale = parseInt(e.target.value, 10);
    sizeVal.textContent = state.wmScale + '%';
    render();
  });

  // Rotation
  btnRotate.addEventListener('click', () => {
    if (!state.img) return;
    state.imgOrientation = (state.imgOrientation + 90) % 360;
    render();
  });

  // Show guides toggle
  showGuidesCheckbox.addEventListener('change', (e) => {
    state.showGuides = e.target.checked;
    render();
  });

  // Download & Copy
  btnDownload.addEventListener('click', downloadProtectedImage);
  btnCopyClipboard.addEventListener('click', copyToClipboard);

  // Keyboard navigation (Delete / Backspace / Esc)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedBoxId) {
        e.preventDefault();
        deleteSelectedBox();
      }
    } else if (e.key === 'Escape') {
      state.selectedBoxId = null;
      btnDeleteSelected.disabled = true;
      render();
    }
  });
}

function updateExportButtons(enabled) {
  btnDownload.disabled = !enabled;
  btnCopyClipboard.disabled = !enabled;
}

function updateBoxBadge() {
  const count = state.boxes.length;
  boxCountBadge.textContent = count === 1 ? '1 zona oculta' : `${count} zonas ocultas`;
}

function addPresetBox(def) {
  const id = 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  state.boxes.push({
    id,
    x: Math.max(0.01, Math.min(0.95, def.x)),
    y: Math.max(0.01, Math.min(0.95, def.y)),
    width: def.width,
    height: def.height,
    label: def.label,
    style: state.activeStyle
  });
  state.selectedBoxId = id;
  btnDeleteSelected.disabled = false;
  updateBoxBadge();
  render();
}

function deleteSelectedBox() {
  if (!state.selectedBoxId) return;
  state.boxes = state.boxes.filter(b => b.id !== state.selectedBoxId);
  state.selectedBoxId = null;
  btnDeleteSelected.disabled = true;
  updateBoxBadge();
  render();
}

// --- DEMO GENERATOR (100% Synthetic, Safe Canvas DNI Sample) ---
function setupDemos() {
  const loadDemo = (type) => {
    const demoCanvas = document.createElement('canvas');
    demoCanvas.width = 1000;
    demoCanvas.height = 630;
    const dctx = demoCanvas.getContext('2d');
    drawSyntheticDNI(dctx, 1000, 630, type);

    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.imgOrientation = 0;
      state.boxes = [];
      state.selectedBoxId = null;
      updateExportButtons(true);
      emptyState.classList.add('hidden');
      canvasWrapper.classList.remove('hidden');

      // Preload recommended boxes for demo
      if (type === 'front') {
        addPresetBox(PRESETS.soporte);
        addPresetBox(PRESETS.firma);
        addPresetBox(PRESETS.can);
      } else {
        addPresetBox(PRESETS.mrz);
        addPresetBox(PRESETS.domicilio);
      }
      render();
    };
    img.src = demoCanvas.toDataURL('image/png');
  };

  btnDemoFront.addEventListener('click', () => loadDemo('front'));
  btnDemoBack.addEventListener('click', () => loadDemo('back'));
  btnEmptyDemo.addEventListener('click', () => loadDemo('front'));
}

function drawSyntheticDNI(ctx, w, h, side) {
  // Background gradient mimicking Spanish DNI polycarbonate card
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#fde68a');
  grad.addColorStop(0.3, '#fed7aa');
  grad.addColorStop(0.7, '#e0e7ff');
  grad.addColorStop(1, '#c7d2fe');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Guilloche / security waves pattern
  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
  ctx.lineWidth = 1.5;
  for (let i = -100; i < w + 200; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.bezierCurveTo(i + 100, h * 0.33, i - 100, h * 0.66, i + 50, h);
    ctx.stroke();
  }
  ctx.restore();

  // Flag & Header
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 22px sans-serif';

  if (side === 'front') {
    // Header
    ctx.fillText('ESPAÑA', 130, 48);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('DOCUMENTO NACIONAL DE IDENTIDAD', 130, 70);

    // EU Flag emblem
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(40, 30, 65, 45);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('★ ES ★', 48, 58);

    // Support # (IDESP)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('NUM. SOPORTE / IDESP: AAA000123', 640, 45);

    // Main photo placeholder
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(40, 100, 210, 270);
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(145, 200, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(145, 330, 80, 0, Math.PI, true);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = '12px sans-serif';
    ctx.fillText('FOTOGRAFÍA DEMO', 88, 360);

    // Secondary ghost photo
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.fillRect(800, 320, 150, 180);
    ctx.strokeRect(800, 320, 150, 180);

    // DNI Data fields
    ctx.fillStyle = '#0f172a';
    ctx.font = '11px sans-serif';
    const fields = [
      { label: 'PRIMER APELLIDO / SURNAME', val: 'GARCÍA', y: 125 },
      { label: 'SEGUNDO APELLIDO', val: 'LÓPEZ', y: 175 },
      { label: 'NOMBRE / GIVEN NAME', val: 'MARÍA DEL CARMEN', y: 225 },
      { label: 'SEXO / SEX', val: 'F', y: 275, x2: 'NACIONALIDAD / NATIONALITY: ESP' },
      { label: 'FECHA NACIMIENTO', val: '14 10 1990', y: 325, x2: 'VALIDEZ: 14 10 2030' },
      { label: 'DNI / NIF', val: '12345678Z', y: 380, big: true }
    ];

    fields.forEach(f => {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(f.label, 280, f.y);
      ctx.fillStyle = '#0f172a';
      ctx.font = f.big ? 'bold 26px monospace' : 'bold 16px sans-serif';
      ctx.fillText(f.val, 280, f.y + 20);

      if (f.x2) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.fillText(f.x2, 530, f.y + 20);
      }
    });

    // Signature area
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(280, 435, 300, 110);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText('FIRMA DEL TITULAR', 285, 450);
    // Fake handwriting signature curve
    ctx.beginPath();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.moveTo(310, 510);
    ctx.bezierCurveTo(340, 460, 380, 520, 420, 480);
    ctx.bezierCurveTo(460, 440, 490, 530, 550, 495);
    ctx.stroke();

    // CAN Code
    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    ctx.fillText('CÓDIGO CAN', 810, 535);
    ctx.font = 'bold 20px monospace';
    ctx.fillText('123456', 810, 565);

  } else {
    // Back of DNI
    ctx.fillText('REVERSO — DIRECCIÓN Y DATOS MECÁNICOS', 50, 45);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('HIJO/A DE:', 50, 85);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('ANTONIO Y CARMEN', 50, 105);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('LUGAR DE NACIMIENTO / PROVINCIA:', 50, 140);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('MADRID (MADRID)', 50, 160);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('DOMICILIO / ADDRESS:', 50, 195);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('CALLE DE LA PRINCESA 24, 3º B', 50, 218);
    ctx.fillText('28008 MADRID (ESPAÑA)', 50, 240);

    // Chip icon
    ctx.fillStyle = '#d97706';
    ctx.fillRect(720, 70, 180, 130);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(740, 90, 140, 90);
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('MICROCHIP DNIe', 755, 140);

    // MRZ (Machine Readable Zone - 3 lines)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(30, 400, 940, 205);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(30, 400, 940, 205);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('IDESP1234567897<<<<<<<<<<<<<<<', 50, 455);
    ctx.fillText('9010148F3010148ESP<<<<<<<<<<<4', 50, 515);
    ctx.fillText('GARCIA<LOPEZ<<MARIA<DEL<CARMEN', 50, 575);
  }
}

// --- MAIN RENDER PIPELINE ---
function render(forExport = false) {
  if (!state.img) return;

  const isRotated = state.imgOrientation === 90 || state.imgOrientation === 270;
  const baseW = isRotated ? state.img.height : state.img.width;
  const baseH = isRotated ? state.img.width : state.img.height;

  // Set canvas dimension
  if (canvas.width !== baseW || canvas.height !== baseH) {
    canvas.width = baseW;
    canvas.height = baseH;
  }

  ctx.save();

  // 1. Draw base image with orientation
  ctx.save();
  ctx.translate(baseW / 2, baseH / 2);
  ctx.rotate((state.imgOrientation * Math.PI) / 180);
  ctx.drawImage(
    state.img,
    -state.img.width / 2,
    -state.img.height / 2,
    state.img.width,
    state.img.height
  );
  ctx.restore();

  // 2. Apply Obfuscation boxes (Pixelate, Blur, Blackout) on base image
  applyObfuscationBoxes(baseW, baseH);

  // 3. Apply Black & White Filter (if enabled)
  if (state.bwEnabled) {
    applyBlackAndWhiteFilter(baseW, baseH);
  }

  // 4. Apply Watermark
  if (state.wmEnabled && state.wmText.trim() !== '') {
    applyWatermark(baseW, baseH);
  }

  // 5. Draw UI Handles / Guides (Only when not exporting)
  if (!forExport && state.showGuides) {
    drawEditorGuides(baseW, baseH);
  }

  ctx.restore();
}

// --- FILTER: OBFUSCATION (Pixelate, Blur, Blackout) ---
function applyObfuscationBoxes(width, height) {
  state.boxes.forEach(box => {
    const bx = Math.round(box.x * width);
    const by = Math.round(box.y * height);
    const bw = Math.round(box.width * width);
    const bh = Math.round(box.height * height);

    if (bw <= 0 || bh <= 0) return;

    // Constrain to canvas
    const x = Math.max(0, bx);
    const y = Math.max(0, by);
    const w = Math.min(width - x, bw);
    const h = Math.min(height - y, bh);

    if (w <= 0 || h <= 0) return;

    const style = box.style || state.activeStyle;

    if (style === 'blackout') {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x, y, w, h);
    } else if (style === 'pixelate') {
      // Scale down and scale up to pixelate
      const blockSize = Math.max(6, Math.round(state.intensity * (width / 900)));
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const smallW = Math.max(1, Math.floor(w / blockSize));
      const smallH = Math.max(1, Math.floor(h / blockSize));

      tempCanvas.width = smallW;
      tempCanvas.height = smallH;
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(canvas, x, y, w, h, 0, 0, smallW, smallH);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, 0, 0, smallW, smallH, x, y, w, h);
      ctx.restore();
    } else if (style === 'blur') {
      // Gaussian/box blur approximation via multi-pass downscale & upscale + context filter
      const blurRadius = Math.max(4, Math.round(state.intensity * (width / 1100)));
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = w;
      tempCanvas.height = h;

      tempCtx.filter = `blur(${blurRadius}px)`;
      tempCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

      ctx.drawImage(tempCanvas, x, y);
    }
  });
}

// --- FILTER: BLACK & WHITE + CONTRAST & BRIGHTNESS ---
function applyBlackAndWhiteFilter(width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const contrastFactor = state.contrast / 100;
  const brightnessFactor = (state.brightness - 100) * 1.5;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Standard ITU-R BT.601 perceptual luminance formula
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Apply brightness
    gray += brightnessFactor;

    // Apply contrast
    gray = (gray - 128) * contrastFactor + 128;

    // Clamp 0..255
    if (gray < 0) gray = 0;
    if (gray > 255) gray = 255;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
}

// --- FILTER: WATERMARK OF PURPOSE ---
function applyWatermark(width, height) {
  let text = state.wmText.trim();
  if (state.wmIncludeDate) {
    text += ` · ${todayStr}`;
  }

  ctx.save();
  const opacity = state.wmOpacity / 100;
  ctx.globalAlpha = opacity;

  // Adaptive font size based on image width and scale slider
  const baseFontSize = Math.max(14, Math.round((width / 42) * (state.wmScale / 100)));
  ctx.font = `bold ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const mode = state.wmMode;
  const color = state.wmColor;

  if (mode === 'tiled') {
    // Diagonal repeating pattern across the entire document
    const angle = -28 * (Math.PI / 180);
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const stepX = Math.max(textWidth + 80, 220);
    const stepY = baseFontSize * 3.8;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);

    const diag = Math.hypot(width, height);
    const startX = -diag;
    const endX = diag;
    const startY = -diag;
    const endY = diag;

    let rowIndex = 0;
    for (let y = startY; y < endY; y += stepY) {
      const offsetX = (rowIndex % 2 === 0) ? 0 : stepX / 2;
      for (let x = startX; x < endX; x += stepX) {
        drawWatermarkText(text, x + offsetX, y, color, baseFontSize);
      }
      rowIndex++;
    }
  } else if (mode === 'single') {
    // Prominent cross stamp across the center
    const angle = -24 * (Math.PI / 180);
    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);

    const stampFontSize = Math.round(baseFontSize * 1.5);
    ctx.font = `900 ${stampFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    
    // Draw stamped box around text
    const tm = ctx.measureText(text);
    const pad = stampFontSize * 0.5;
    ctx.lineWidth = Math.max(3, stampFontSize / 12);
    ctx.strokeStyle = color;
    ctx.strokeRect(-tm.width / 2 - pad, -stampFontSize * 0.9, tm.width + pad * 2, stampFontSize * 1.8);

    drawWatermarkText(text, 0, 0, color, stampFontSize);
  } else if (mode === 'banner') {
    // 2 Semi-transparent horizontal ribbons (top & bottom)
    const ribbonH = baseFontSize * 2;
    
    // Top banner
    drawRibbon(0, height * 0.22, width, ribbonH, text, color, baseFontSize);
    // Bottom banner
    drawRibbon(0, height * 0.72, width, ribbonH, text, color, baseFontSize);
  }

  ctx.restore();
}

function drawWatermarkText(text, x, y, color, fontSize) {
  // Outline stroke for readability on any background
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = color === '#ffffff' ? '#000000' : '#ffffff';
  ctx.lineWidth = Math.max(2, fontSize / 8);
  ctx.strokeText(text, x, y);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawRibbon(rx, ry, rw, rh, text, color, fontSize) {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.fillRect(rx, ry - rh / 2, rw, rh);
  drawWatermarkText(text, rw / 2, ry, color, fontSize);
}

// --- INTERACTIVE EDITING GUIDES & HANDLES ---
const HANDLE_SIZE = 10;

function drawEditorGuides(width, height) {
  state.boxes.forEach(box => {
    const isSelected = box.id === state.selectedBoxId;
    const x = box.x * width;
    const y = box.y * height;
    const w = box.width * width;
    const h = box.height * height;

    ctx.save();
    // Dashed or solid border
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.strokeStyle = isSelected ? '#2563eb' : 'rgba(37, 99, 235, 0.5)';
    ctx.setLineDash(isSelected ? [] : [5, 4]);
    ctx.strokeRect(x, y, w, h);

    // Label tag
    const label = box.label || 'Zona oculta';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    const tagW = ctx.measureText(label).width + 12;
    const tagH = 18;
    ctx.fillStyle = isSelected ? '#2563eb' : 'rgba(30, 41, 59, 0.75)';
    ctx.fillRect(x, Math.max(0, y - tagH), tagW, tagH);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 6, Math.max(0, y - tagH) + tagH / 2);

    // Corner handles if selected
    if (isSelected) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      const corners = [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h }
      ];

      corners.forEach(pt => {
        ctx.fillRect(pt.x - HANDLE_SIZE / 2, pt.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(pt.x - HANDLE_SIZE / 2, pt.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      });
    }

    ctx.restore();
  });

  // Current drawing box preview
  if (state.interaction.mode === 'drawing') {
    const cur = state.interaction;
    const x = Math.min(cur.startX, cur.currentX);
    const y = Math.min(cur.startY, cur.currentY);
    const w = Math.abs(cur.currentX - cur.startX);
    const h = Math.abs(cur.currentY - cur.startY);

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(37, 99, 235, 0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

// --- CANVAS MOUSE / TOUCH EVENTS (DRAW, RESIZE, MOVE) ---
function setupCanvasEvents() {
  const getCanvasCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const findHitHandle = (box, px, py) => {
    const w = canvas.width;
    const h = canvas.height;
    const bx = box.x * w;
    const by = box.y * h;
    const bw = box.width * w;
    const bh = box.height * h;
    const tol = HANDLE_SIZE + 4;

    const handles = {
      nw: Math.hypot(px - bx, py - by) < tol,
      ne: Math.hypot(px - (bx + bw), py - by) < tol,
      se: Math.hypot(px - (bx + bw), py - (by + bh)) < tol,
      sw: Math.hypot(px - bx, py - (by + bh)) < tol
    };

    for (let k in handles) {
      if (handles[k]) return k;
    }
    return null;
  };

  const findHitBox = (px, py) => {
    const w = canvas.width;
    const h = canvas.height;
    // Iterate in reverse so top boxes get selected first
    for (let i = state.boxes.length - 1; i >= 0; i--) {
      const b = state.boxes[i];
      const bx = b.x * w;
      const by = b.y * h;
      const bw = b.width * w;
      const bh = b.height * h;
      if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
        return b;
      }
    }
    return null;
  };

  // Pointer Down
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.img) return;
    const coords = getCanvasCoords(e);
    const px = coords.x;
    const py = coords.y;

    // Check if clicked on handle of selected box
    if (state.selectedBoxId) {
      const selBox = state.boxes.find(b => b.id === state.selectedBoxId);
      if (selBox) {
        const handle = findHitHandle(selBox, px, py);
        if (handle) {
          state.interaction = {
            mode: 'resizing',
            resizeHandle: handle,
            activeBox: selBox,
            startX: px,
            startY: py,
            origBox: { ...selBox }
          };
          return;
        }
      }
    }

    // Check if clicked inside a box
    const hitBox = findHitBox(px, py);
    if (hitBox) {
      state.selectedBoxId = hitBox.id;
      btnDeleteSelected.disabled = false;
      state.interaction = {
        mode: 'moving',
        activeBox: hitBox,
        startX: px,
        startY: py,
        origBox: { ...hitBox },
        dragOffset: {
          x: px - (hitBox.x * canvas.width),
          y: py - (hitBox.y * canvas.height)
        }
      };
      render();
      return;
    }

    // Otherwise, start drawing a new redaction box
    state.selectedBoxId = null;
    btnDeleteSelected.disabled = true;
    state.interaction = {
      mode: 'drawing',
      startX: px,
      startY: py,
      currentX: px,
      currentY: py
    };
    render();
  });

  // Pointer Move
  canvas.addEventListener('pointermove', (e) => {
    if (!state.img) return;
    const coords = getCanvasCoords(e);
    const px = coords.x;
    const py = coords.y;
    const cur = state.interaction;

    // Update cursor style
    if (cur.mode === 'idle') {
      if (state.selectedBoxId) {
        const selBox = state.boxes.find(b => b.id === state.selectedBoxId);
        if (selBox) {
          const handle = findHitHandle(selBox, px, py);
          if (handle) {
            canvas.style.cursor = (handle === 'nw' || handle === 'se') ? 'nwse-resize' : 'nesw-resize';
            return;
          }
        }
      }
      const hit = findHitBox(px, py);
      canvas.style.cursor = hit ? 'move' : 'crosshair';
      return;
    }

    if (cur.mode === 'drawing') {
      cur.currentX = px;
      cur.currentY = py;
      render();
    } else if (cur.mode === 'moving') {
      const b = cur.activeBox;
      const newX = (px - cur.dragOffset.x) / canvas.width;
      const newY = (py - cur.dragOffset.y) / canvas.height;
      b.x = Math.max(0, Math.min(1 - b.width, newX));
      b.y = Math.max(0, Math.min(1 - b.height, newY));
      render();
    } else if (cur.mode === 'resizing') {
      const b = cur.activeBox;
      const orig = cur.origBox;
      const dx = (px - cur.startX) / canvas.width;
      const dy = (py - cur.startY) / canvas.height;
      const handle = cur.resizeHandle;

      if (handle === 'se') {
        b.width = Math.max(0.02, Math.min(1 - b.x, orig.width + dx));
        b.height = Math.max(0.02, Math.min(1 - b.y, orig.height + dy));
      } else if (handle === 'sw') {
        const newW = Math.max(0.02, orig.width - dx);
        b.x = orig.x + (orig.width - newW);
        b.width = newW;
        b.height = Math.max(0.02, Math.min(1 - b.y, orig.height + dy));
      } else if (handle === 'ne') {
        b.width = Math.max(0.02, Math.min(1 - b.x, orig.width + dx));
        const newH = Math.max(0.02, orig.height - dy);
        b.y = orig.y + (orig.height - newH);
        b.height = newH;
      } else if (handle === 'nw') {
        const newW = Math.max(0.02, orig.width - dx);
        const newH = Math.max(0.02, orig.height - dy);
        b.x = orig.x + (orig.width - newW);
        b.y = orig.y + (orig.height - newH);
        b.width = newW;
        b.height = newH;
      }
      render();
    }
  });

  // Pointer Up / Leave
  const handlePointerEnd = () => {
    const cur = state.interaction;
    if (cur.mode === 'drawing') {
      const minX = Math.min(cur.startX, cur.currentX);
      const minY = Math.min(cur.startY, cur.currentY);
      const w = Math.abs(cur.currentX - cur.startX);
      const h = Math.abs(cur.currentY - cur.startY);

      // Only save if drawn rectangle is larger than 10x10 px
      if (w > 10 && h > 10) {
        const id = 'box_' + Date.now();
        state.boxes.push({
          id,
          x: minX / canvas.width,
          y: minY / canvas.height,
          width: w / canvas.width,
          height: h / canvas.height,
          label: 'Zona manual',
          style: state.activeStyle
        });
        state.selectedBoxId = id;
        btnDeleteSelected.disabled = false;
        updateBoxBadge();
      }
    }
    state.interaction = { mode: 'idle' };
    render();
  };

  canvas.addEventListener('pointerup', handlePointerEnd);
  canvas.addEventListener('pointercancel', handlePointerEnd);
}

// --- EXPORT: DOWNLOAD & CLIPBOARD ---
function downloadProtectedImage() {
  if (!state.img) return;

  // Render clean version without editor guides
  render(true);

  const format = exportFormat.value;
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const quality = format === 'image/jpeg' ? 0.92 : undefined;

  const dataUrl = canvas.toDataURL(format, quality);
  const link = document.createElement('a');
  link.download = `DNI_Protegido_${Date.now()}.${ext}`;
  link.href = dataUrl;
  link.click();

  // Restore editor guides view
  render(false);
}

async function copyToClipboard() {
  if (!state.img) return;
  if (!navigator.clipboard || !window.ClipboardItem) {
    alert('Tu navegador no admite copiar imágenes directamente al portapapeles. Usa el botón "Descargar DNI Protegido".');
    return;
  }

  // Render clean version
  render(true);

  try {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      const prevText = btnCopyClipboard.textContent;
      btnCopyClipboard.textContent = '✓ ¡Copiado!';
      setTimeout(() => {
        btnCopyClipboard.textContent = prevText;
      }, 2000);
    }, 'image/png');
  } catch (err) {
    console.error('Clipboard error:', err);
    alert('No se pudo copiar al portapapeles. Prueba a usar el botón Descargar.');
  } finally {
    render(false);
  }
}

// Start application
window.addEventListener('DOMContentLoaded', init);
