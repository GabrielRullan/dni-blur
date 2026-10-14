/**
 * ProtegeDNI — Anonimizador de DNI Español (100% En el cliente / On-device)
 * Garantiza privacidad total: no sube nada a ningún servidor.
 */

// Application State
const state = {
  img: null, // HTMLImageElement loaded
  imgOrientation: 0, // 0, 90, 180, 270 degrees
  
  // App Mode: 'simple' (default, streamlined, pixelate, no B&W options shown) or 'advanced'
  appMode: 'simple',

  // Boxes: { id, x, y, width, height, label, style: 'pixelate'|'blur'|'blackout' } (stored in 0..1 normalized coordinates)
  boxes: [],
  selectedBoxId: null,
  activeStyle: 'pixelate',
  intensity: 18,
  
  // B&W options (active by default, hidden controls in simple mode)
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
  
  // Calibration State: allows user to click top-left and bottom-right corners of DNI
  calibration: {
    active: false,
    step: 0, // 0: inactive, 1: waiting top-left, 2: waiting bottom-right
    topLeft: null, // { x: 0..1, y: 0..1 }
    bottomRight: null // { x: 0..1, y: 0..1 }
  },

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
const btnDemoFrontThumb = document.getElementById('btn-demo-front-thumb');
const btnDemoBackThumb = document.getElementById('btn-demo-back-thumb');
const btnClearBoxes = document.getElementById('btn-clear-boxes');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const btnRecommendAEPD = document.getElementById('btn-recommend-aepd');
const btnModalApplyAEPD = document.getElementById('btn-modal-apply-aepd');
const btnDownload = document.getElementById('btn-download');
const btnCopyClipboard = document.getElementById('btn-copy-clipboard');
const boxCountBadge = document.getElementById('box-count-badge');
const showGuidesCheckbox = document.getElementById('show-guides');

// Mode toggle
const btnModeSimple = document.getElementById('btn-mode-simple');
const btnModeAdvanced = document.getElementById('btn-mode-advanced');
const advancedElements = document.querySelectorAll('.advanced-only');
const badgeWm = document.getElementById('badge-wm');

// Calibration elements
const calibrationBar = document.getElementById('calibration-bar');
const calibIndicator = document.getElementById('calib-indicator');
const calibInstruction = document.getElementById('calib-instruction');
const btnStartCalibration = document.getElementById('btn-start-calibration');
const btnCancelCalib = document.getElementById('btn-cancel-calib');
const btnResetCalib = document.getElementById('btn-reset-calib');

// Guide modal
const guideModal = document.getElementById('guide-modal');
const btnOpenGuide = document.getElementById('btn-open-guide');
const btnCloseGuide = document.getElementById('btn-close-guide');

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

// Preset definitions (Normalized 0..1 bounding boxes based on standard Spanish DNI 3.0 / 4.0 layout)
const PRESETS = {
  // Front of DNI (Reino de España Specimen layout)
  firma: { x: 0.43, y: 0.74, width: 0.31, height: 0.16, label: 'Firma' },
  can: { x: 0.75, y: 0.79, width: 0.22, height: 0.13, label: 'Código CAN' },
  soporte: { x: 0.39, y: 0.65, width: 0.25, height: 0.10, label: 'Nº Soporte' },
  validez: { x: 0.57, y: 0.57, width: 0.19, height: 0.08, label: 'Validez' },
  nacimiento: { x: 0.77, y: 0.48, width: 0.19, height: 0.08, label: 'Fecha Nac.' },
  foto_extra: { x: 0.81, y: 0.58, width: 0.15, height: 0.20, label: 'Foto sec.' },
  
  // Back of DNI
  mrz: { x: 0.04, y: 0.64, width: 0.92, height: 0.31, label: 'MRZ (Lectura)' },
  domicilio: { x: 0.28, y: 0.06, width: 0.38, height: 0.23, label: 'Domicilio' },
  padres: { x: 0.28, y: 0.48, width: 0.34, height: 0.12, label: 'Nombre Padres' },
  lugar_nac: { x: 0.28, y: 0.31, width: 0.30, height: 0.15, label: 'Lugar Nac.' }
};

// --- INITIALIZATION ---
function init() {
  setupFileUpload();
  setupCanvasEvents();
  setupControls();
  setupDemos();
  setupCalibration();
  setupGuideModal();
  setMode('simple'); // Default to simple mode
}

// Mode switcher (Simple vs Advanced)
function setMode(mode) {
  state.appMode = mode;
  if (mode === 'simple') {
    btnModeSimple.classList.add('active');
    btnModeAdvanced.classList.remove('active');
    advancedElements.forEach(el => el.classList.add('hidden'));
    state.activeStyle = 'pixelate';
    state.intensity = 18;
    state.bwEnabled = true; // Always B&W in simple mode for maximum security
    if (badgeWm) badgeWm.textContent = '2';
  } else {
    btnModeSimple.classList.remove('active');
    btnModeAdvanced.classList.add('active');
    advancedElements.forEach(el => el.classList.remove('hidden'));
    if (badgeWm) badgeWm.textContent = '3';
  }
  render();
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
      resetCalibration();
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
  // Mode switch buttons
  btnModeSimple.addEventListener('click', () => setMode('simple'));
  btnModeAdvanced.addEventListener('click', () => setMode('advanced'));

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
  if (redactIntensity) {
    redactIntensity.addEventListener('input', (e) => {
      state.intensity = parseInt(e.target.value, 10);
      const v = state.intensity;
      intensityVal.textContent = v < 14 ? 'Baja' : v > 26 ? 'Alta' : 'Media';
      render();
    });
  }

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

  // Preset chips (Toggle on click: adds if absent, removes if already active)
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset;
      const def = PRESETS[key];
      if (!def) return;
      if (!state.img) {
        alert('Carga primero una imagen o usa una demo para aplicar plantillas.');
        return;
      }
      togglePresetBox(key, def);
    });
  });

  // Chip info icons -> open modal and scroll to item
  document.querySelectorAll('.chip-info').forEach(infoBtn => {
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const infoKey = infoBtn.dataset.info;
      openGuideModal(infoKey);
    });
  });

  // Recommended button (AEPD & Police recommended: Signature + CAN + Support #)
  const applyRecommended = () => {
    if (!state.img) {
      alert('Carga primero una imagen de DNI.');
      return;
    }
    // Check if all recommended are already active; if so, toggle them off
    const recKeys = ['soporte', 'firma', 'can'];
    const allActive = recKeys.every(k => state.boxes.some(b => b.presetKey === k));
    
    if (allActive) {
      // Remove all recommended
      state.boxes = state.boxes.filter(b => !recKeys.includes(b.presetKey));
      state.selectedBoxId = null;
      btnDeleteSelected.disabled = true;
    } else {
      // Add missing ones
      recKeys.forEach(k => {
        if (!state.boxes.some(b => b.presetKey === k) && PRESETS[k]) {
          addPresetBox(PRESETS[k], k);
        }
      });
    }
    updateBoxBadge();
    syncPresetButtonsState();
    render();
  };

  btnRecommendAEPD.addEventListener('click', applyRecommended);
  btnModalApplyAEPD.addEventListener('click', () => {
    closeGuideModal();
    if (state.img) {
      applyRecommended();
    } else {
      // If no image, load front demo and apply
      loadDemoImage('Spanish_ID_card_(front_side).webp', 'front');
    }
  });

  // Delete selected box
  btnDeleteSelected.addEventListener('click', deleteSelectedBox);

  // Clear all boxes
  btnClearBoxes.addEventListener('click', () => {
    if (state.boxes.length === 0) return;
    if (confirm('¿Eliminar todas las zonas ocultas?')) {
      state.boxes = [];
      state.selectedBoxId = null;
      btnDeleteSelected.disabled = true;
      updateBoxBadge();
      syncPresetButtonsState();
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

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedBoxId) {
        e.preventDefault();
        deleteSelectedBox();
      }
    } else if (e.key === 'Escape') {
      if (state.calibration.active) {
        cancelCalibration();
      } else {
        state.selectedBoxId = null;
        btnDeleteSelected.disabled = true;
        render();
      }
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

// Add preset box applying calibration transformation if available
// Sync the visual active state of preset buttons with current boxes
function syncPresetButtonsState() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    const key = btn.dataset.preset;
    const isPresent = state.boxes.some(b => b.presetKey === key);
    if (isPresent) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Also check if AEPD button is active
  if (btnRecommendAEPD) {
    const recKeys = ['soporte', 'firma', 'can'];
    const allActive = recKeys.every(k => state.boxes.some(b => b.presetKey === k));
    if (allActive) {
      btnRecommendAEPD.classList.add('active');
    } else {
      btnRecommendAEPD.classList.remove('active');
    }
  }
}

// Toggle preset box: if already present, removes it; otherwise adds it
function togglePresetBox(key, def) {
  const existingIndex = state.boxes.findIndex(b => b.presetKey === key);
  if (existingIndex !== -1) {
    // Remove it
    const removed = state.boxes.splice(existingIndex, 1)[0];
    if (state.selectedBoxId === removed.id) {
      state.selectedBoxId = null;
      btnDeleteSelected.disabled = true;
    }
    updateBoxBadge();
    syncPresetButtonsState();
    render();
    return;
  }

  // Otherwise, add it
  addPresetBox(def, key);
}

// Add preset box applying calibration transformation if available
function addPresetBox(def, key = null) {
  const id = 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  
  let x = def.x;
  let y = def.y;
  let width = def.width;
  let height = def.height;

  // Apply calibration mapping if set
  if (state.calibration.topLeft && state.calibration.bottomRight) {
    const tl = state.calibration.topLeft;
    const br = state.calibration.bottomRight;
    const spanX = br.x - tl.x;
    const spanY = br.y - tl.y;
    x = tl.x + def.x * spanX;
    y = tl.y + def.y * spanY;
    width = def.width * spanX;
    height = def.height * spanY;
  }

  state.boxes.push({
    id,
    presetKey: key,
    x: Math.max(0.005, Math.min(0.98, x)),
    y: Math.max(0.005, Math.min(0.98, y)),
    width: Math.max(0.02, width),
    height: Math.max(0.02, height),
    label: def.label,
    style: state.activeStyle
  });

  state.selectedBoxId = id;
  btnDeleteSelected.disabled = false;
  updateBoxBadge();
  syncPresetButtonsState();
  render();
}

function deleteSelectedBox() {
  if (!state.selectedBoxId) return;
  state.boxes = state.boxes.filter(b => b.id !== state.selectedBoxId);
  state.selectedBoxId = null;
  btnDeleteSelected.disabled = true;
  updateBoxBadge();
  syncPresetButtonsState();
  render();
}

// --- CALIBRATION (2-Point Anchor Alignment for Custom User Photos) ---
function setupCalibration() {
  btnStartCalibration.addEventListener('click', () => {
    if (!state.img) {
      alert('Carga primero una imagen de DNI para calibrar.');
      return;
    }
    startCalibration();
  });

  btnCancelCalib.addEventListener('click', cancelCalibration);
  btnResetCalib.addEventListener('click', () => {
    resetCalibration();
    cancelCalibration();
    render();
  });
}

function startCalibration() {
  state.calibration.active = true;
  state.calibration.step = 1;
  calibrationBar.classList.remove('hidden');
  calibIndicator.textContent = 'Paso 1 de 2';
  calibInstruction.innerHTML = 'Toca la <strong>esquina superior izquierda</strong> del DNI';
  canvas.style.cursor = 'crosshair';
}

function cancelCalibration() {
  state.calibration.active = false;
  state.calibration.step = 0;
  calibrationBar.classList.add('hidden');
  canvas.style.cursor = 'default';
  render();
}

function resetCalibration() {
  state.calibration.topLeft = null;
  state.calibration.bottomRight = null;
  btnStartCalibration.textContent = '🎯 Ajustar esquinas del DNI (Mejora plantillas)';
}

function handleCalibrationClick(normX, normY) {
  if (state.calibration.step === 1) {
    state.calibration.topLeft = { x: normX, y: normY };
    state.calibration.step = 2;
    calibIndicator.textContent = 'Paso 2 de 2';
    calibInstruction.innerHTML = 'Ahora toca la <strong>esquina inferior derecha</strong> del DNI';
    render();
  } else if (state.calibration.step === 2) {
    const tl = state.calibration.topLeft;
    // Ensure bottom right is indeed lower and further right
    state.calibration.bottomRight = {
      x: Math.max(tl.x + 0.1, normX),
      y: Math.max(tl.y + 0.1, normY)
    };
    state.calibration.active = false;
    state.calibration.step = 0;
    calibrationBar.classList.add('hidden');
    canvas.style.cursor = 'default';
    btnStartCalibration.textContent = '✓ DNI Calibrado (Reajustar)';
    render();
  }
}

// --- DEMO LOADER (Uses Uploaded Spanish DNI Real Images) ---
function setupDemos() {
  const loadDemo = (imagePath, side) => {
    loadDemoImage(imagePath, side);
  };

  btnDemoFront.addEventListener('click', () => loadDemo('Spanish_ID_card_(front_side).webp', 'front'));
  btnDemoBack.addEventListener('click', () => loadDemo('back.jpg', 'back'));
  if (btnDemoFrontThumb) {
    btnDemoFrontThumb.addEventListener('click', () => loadDemo('Spanish_ID_card_(front_side).webp', 'front'));
  }
  if (btnDemoBackThumb) {
    btnDemoBackThumb.addEventListener('click', () => loadDemo('back.jpg', 'back'));
  }
}

function loadDemoImage(imagePath, side) {
  const img = new Image();
  img.onload = () => {
    state.img = img;
    state.imgOrientation = 0;
    state.boxes = [];
    state.selectedBoxId = null;
    resetCalibration();
    updateExportButtons(true);
    emptyState.classList.add('hidden');
    canvasWrapper.classList.remove('hidden');

    // Switch to corresponding tab
    if (side === 'front') {
      presetTabs[0].click();
      addPresetBox(PRESETS.soporte, 'soporte');
      addPresetBox(PRESETS.firma, 'firma');
      addPresetBox(PRESETS.can, 'can');
    } else {
      presetTabs[1].click();
      addPresetBox(PRESETS.mrz, 'mrz');
      addPresetBox(PRESETS.domicilio, 'domicilio');
    }
    render();
  };
  img.src = imagePath;
}

// --- GUIDE MODAL (Explanatory Privacy Info) ---
function setupGuideModal() {
  btnOpenGuide.addEventListener('click', () => openGuideModal());
  btnCloseGuide.addEventListener('click', closeGuideModal);
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) closeGuideModal();
  });
}

function openGuideModal(targetId) {
  guideModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Highlight specific item if triggered from chip info
  document.querySelectorAll('.guide-item').forEach(item => item.classList.remove('highlighted'));
  if (targetId) {
    const el = document.getElementById('guide-item-' + targetId);
    if (el) {
      el.classList.add('highlighted');
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }
}

function closeGuideModal() {
  guideModal.classList.add('hidden');
  document.body.style.overflow = '';
}

// --- MAIN RENDER PIPELINE ---
function render(forExport = false) {
  if (!state.img) return;

  const isRotated = state.imgOrientation === 90 || state.imgOrientation === 270;
  const baseW = isRotated ? state.img.height : state.img.width;
  const baseH = isRotated ? state.img.width : state.img.height;

  // Set canvas dimensions
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

  // 5. Draw UI Handles, Guides and Calibration markers (Only in live editor)
  if (!forExport) {
    if (state.showGuides) {
      drawEditorGuides(baseW, baseH);
    }
    if (state.calibration.active || state.calibration.topLeft) {
      drawCalibrationMarkers(baseW, baseH);
    }
  }

  ctx.restore();
}

// --- FILTER: OBFUSCATION ---
function applyObfuscationBoxes(width, height) {
  state.boxes.forEach(box => {
    const bx = Math.round(box.x * width);
    const by = Math.round(box.y * height);
    const bw = Math.round(box.width * width);
    const bh = Math.round(box.height * height);

    if (bw <= 0 || bh <= 0) return;

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
    gray += brightnessFactor;
    gray = (gray - 128) * contrastFactor + 128;

    if (gray < 0) gray = 0;
    if (gray > 255) gray = 255;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
}

// --- FILTER: WATERMARK ---
function applyWatermark(width, height) {
  let text = state.wmText.trim();
  if (state.wmIncludeDate) {
    text += ` · ${todayStr}`;
  }

  ctx.save();
  const opacity = state.wmOpacity / 100;
  ctx.globalAlpha = opacity;

  const baseFontSize = Math.max(14, Math.round((width / 42) * (state.wmScale / 100)));
  ctx.font = `bold ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const mode = state.wmMode;
  const color = state.wmColor;

  if (mode === 'tiled') {
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
    const angle = -24 * (Math.PI / 180);
    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);

    const stampFontSize = Math.round(baseFontSize * 1.5);
    ctx.font = `900 ${stampFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    
    const tm = ctx.measureText(text);
    const pad = stampFontSize * 0.5;
    ctx.lineWidth = Math.max(3, stampFontSize / 12);
    ctx.strokeStyle = color;
    ctx.strokeRect(-tm.width / 2 - pad, -stampFontSize * 0.9, tm.width + pad * 2, stampFontSize * 1.8);

    drawWatermarkText(text, 0, 0, color, stampFontSize);
  } else if (mode === 'banner') {
    const ribbonH = baseFontSize * 2;
    drawRibbon(0, height * 0.22, width, ribbonH, text, color, baseFontSize);
    drawRibbon(0, height * 0.72, width, ribbonH, text, color, baseFontSize);
  }

  ctx.restore();
}

function drawWatermarkText(text, x, y, color, fontSize) {
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

// --- CALIBRATION MARKERS DRAWING ---
function drawCalibrationMarkers(width, height) {
  ctx.save();
  const tl = state.calibration.topLeft;
  const br = state.calibration.bottomRight;

  if (tl) {
    drawTargetPin(tl.x * width, tl.y * height, '#2563eb', '1: Esquina Superior');
  }
  if (br) {
    drawTargetPin(br.x * width, br.y * height, '#059669', '2: Esquina Inferior');

    // Draw calibrated frame
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(tl.x * width, tl.y * height, (br.x - tl.x) * width, (br.y - tl.y) * height);
  }
  ctx.restore();
}

function drawTargetPin(px, py, color, label) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(px, py, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  // Tag
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = color;
  const tm = ctx.measureText(label);
  ctx.fillRect(px + 12, py - 10, tm.width + 10, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, px + 17, py + 4);

  ctx.restore();
}

// --- INTERACTIVE EDITING GUIDES & HANDLES ---
const HANDLE_SIZE = 12;

function drawEditorGuides(width, height) {
  state.boxes.forEach(box => {
    const isSelected = box.id === state.selectedBoxId;
    const x = box.x * width;
    const y = box.y * height;
    const w = box.width * width;
    const h = box.height * height;

    ctx.save();
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.strokeStyle = isSelected ? '#2563eb' : 'rgba(37, 99, 235, 0.6)';
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

  // Current drawing preview
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

// --- CANVAS MOUSE / TOUCH EVENTS ---
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
    const tol = HANDLE_SIZE + 6;

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

    // If calibration is active, record calibration point and return
    if (state.calibration.active) {
      handleCalibrationClick(px / canvas.width, py / canvas.height);
      return;
    }

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
    if (!state.img || state.calibration.active) return;
    const coords = getCanvasCoords(e);
    const px = coords.x;
    const py = coords.y;
    const cur = state.interaction;

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
    if (state.calibration.active) return;
    const cur = state.interaction;
    if (cur.mode === 'drawing') {
      const minX = Math.min(cur.startX, cur.currentX);
      const minY = Math.min(cur.startY, cur.currentY);
      const w = Math.abs(cur.currentX - cur.startX);
      const h = Math.abs(cur.currentY - cur.startY);

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

  render(true);

  const format = exportFormat.value;
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const quality = format === 'image/jpeg' ? 0.92 : undefined;

  const dataUrl = canvas.toDataURL(format, quality);
  const link = document.createElement('a');
  link.download = `DNI_Protegido_${Date.now()}.${ext}`;
  link.href = dataUrl;
  link.click();

  render(false);
}

async function copyToClipboard() {
  if (!state.img) return;
  if (!navigator.clipboard || !window.ClipboardItem) {
    alert('Tu navegador no admite copiar imágenes directamente al portapapeles. Usa el botón "Descargar".');
    return;
  }

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
    alert('No se pudo copiar al portapapeles. Usa el botón Descargar.');
  } finally {
    render(false);
  }
}

// Start application
window.addEventListener('DOMContentLoaded', init);
