/**
 * ProtegeDNI — Anonimizador de DNI Español (100% En el cliente / On-device)
 * Garantiza privacidad total: no sube nada a ningún servidor.
 */

// Helper to create a clean state container for a single side
function createSideState() {
  return {
    img: null,
    imgOrientation: 0,
    fineRotation: 0,
    originalImg: null,
    originalOrientation: 0,
    hasCropped: false,
    boxes: [],
    calibration: { topLeft: null, bottomRight: null }
  };
}

// Application State
const state = {
  // Current active view side: 'front' | 'back' | 'both'
  currentSide: 'front',
  // Layout when viewing or exporting both sides: 'vertical' (top/bottom) | 'horizontal' (side-by-side)
  mergeLayout: 'vertical',
  
  // Independent data per side
  sides: {
    front: createSideState(),
    back: createSideState()
  },
  // Bounding rects of cards on merged canvas (for interactive live clicking)
  lastMergedBounds: null,

  // Active side editing parameters (synced with state.sides[state.currentSide])
  img: null, // HTMLImageElement loaded
  imgOrientation: 0, // 0, 90, 180, 270 degrees
  fineRotation: 0, // -15 to +15 degrees
  originalImg: null, // pristine original image before any crops
  originalOrientation: 0,
  hasCropped: false,
  
  // App Mode: 'simple' (default, streamlined, pixelate, no B&W options shown) or 'advanced'
  appMode: 'simple',

  // Crop State
  crop: {
    active: false,
    ratio: 'dni', // 'dni' (85.6:54 ~ 1.58577), 'free', '1:1'
    rect: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }, // 0..1 normalized coords
    handle: null, // 'nw'|'ne'|'se'|'sw'|'n'|'s'|'e'|'w'|'move'
    dragStart: { x: 0, y: 0 },
    origRect: null
  },

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

// Side switcher & union DOM elements
const faceTabBtns = document.querySelectorAll('.face-tab-btn');
const panelSideBtns = document.querySelectorAll('.panel-side-segments .seg-btn');
const slotCardFront = document.getElementById('slot-card-front');
const slotCardBack = document.getElementById('slot-card-back');
const statusTagFront = document.getElementById('status-tag-front');
const statusTagBack = document.getElementById('status-tag-back');
const btnClearFront = document.getElementById('btn-clear-front');
const btnClearBack = document.getElementById('btn-clear-back');
const fileInputFront = document.getElementById('file-input-front');
const fileInputBack = document.getElementById('file-input-back');
const mergeLayoutPills = document.getElementById('merge-layout-pills');
const mergeOptionsBox = document.getElementById('merge-options-box');
const mergeLayoutBtns = document.querySelectorAll('[data-merge-layout]');
const btnDemoBoth = document.getElementById('btn-demo-both');
const btnDemoBothThumb = document.getElementById('btn-demo-both-thumb');
const exportTargetBadge = document.getElementById('export-target-badge');
const btnDownloadText = document.getElementById('btn-download-text');
const framingTargetLabel = document.getElementById('framing-target-label');
const toolbarHint = document.getElementById('toolbar-hint');
const hintText = document.getElementById('hint-text');
const guidesToggleWrap = document.getElementById('guides-toggle-wrap');

// Rotate, Crop & Framing controls
const btnRotate = document.getElementById('btn-rotate');
const btnRotateLeft = document.getElementById('btn-rotate-left');
const btnRotateRight = document.getElementById('btn-rotate-right');
const btnCropToggle = document.getElementById('btn-crop-toggle');
const btnPanelCrop = document.getElementById('btn-panel-crop');
const btnRestoreOriginal = document.getElementById('btn-restore-original');
const btnPanelRotLeft = document.getElementById('btn-panel-rot-left');
const btnPanelRotRight = document.getElementById('btn-panel-rot-right');
const straightenSlider = document.getElementById('straighten-slider');
const straightenVal = document.getElementById('straighten-val');
const btnResetStraighten = document.getElementById('btn-reset-straighten');

// Crop Bar elements
const cropBar = document.getElementById('crop-bar');
const btnApplyCrop = document.getElementById('btn-apply-crop');
const btnCancelCrop = document.getElementById('btn-cancel-crop');
const btnResetCropBox = document.getElementById('btn-reset-crop-box');
const cropRatioButtons = document.querySelectorAll('.btn-crop-ratio');

// Demos & standard actions
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

// Animation modal elements
const animationModal = document.getElementById('animation-modal');
const btnOpenAnimation = document.getElementById('btn-open-animation');
const btnEmptyAnimation = document.getElementById('btn-empty-animation');
const btnCloseAnimation = document.getElementById('btn-close-animation');
const btnAnimCloseBottom = document.getElementById('btn-anim-close-bottom');
const btnAnimPlay = document.getElementById('btn-anim-play');
const animPlayIcon = document.getElementById('anim-play-icon');
const animPlayText = document.getElementById('anim-play-text');
const btnAnimPrev = document.getElementById('btn-anim-prev');
const btnAnimNext = document.getElementById('btn-anim-next');
const btnAnimRestart = document.getElementById('btn-anim-restart');
const btnAnimSpeed = document.getElementById('btn-anim-speed');
const animProgressBar = document.getElementById('anim-progress-bar');
const animStepChips = document.querySelectorAll('.anim-step-chip');
const animDniCard = document.getElementById('anim-dni-card');
const animCropFrame = document.getElementById('anim-crop-frame');
const animWatermarkLayer = document.getElementById('anim-watermark-layer');
const animSuccessShield = document.getElementById('anim-success-shield');
const animStepNum = document.getElementById('anim-step-num');
const animStepHeading = document.getElementById('anim-step-heading');
const animStepText = document.getElementById('anim-step-text');
const btnAnimTryDemo = document.getElementById('btn-anim-try-demo');

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
  firma: { x: 0.43, y: 0.74, width: 0.31, height: 0.16, label: 'Firma manuscrita' },
  can: { x: 0.75, y: 0.79, width: 0.22, height: 0.13, label: 'Clave CAN' },
  soporte: { x: 0.39, y: 0.65, width: 0.25, height: 0.10, label: 'Nº Soporte / IDESP' },
  validez: { x: 0.57, y: 0.57, width: 0.19, height: 0.08, label: 'Validez' },
  nacimiento: { x: 0.77, y: 0.48, width: 0.19, height: 0.08, label: 'Fecha Nac.' },
  foto_extra: { x: 0.81, y: 0.58, width: 0.15, height: 0.20, label: 'Foto secundaria' },
  
  // Back of DNI
  mrz: { x: 0.04, y: 0.64, width: 0.92, height: 0.31, label: 'Líneas lectura <<<' },
  domicilio: { x: 0.28, y: 0.06, width: 0.38, height: 0.23, label: 'Dirección (Domicilio)' },
  padres: { x: 0.28, y: 0.48, width: 0.34, height: 0.12, label: 'Nombre Padres' },
  lugar_nac: { x: 0.28, y: 0.31, width: 0.30, height: 0.15, label: 'Lugar Nac.' }
};

// Accessible Toast Notification Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.96)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 3200);
}

// --- INITIALIZATION ---
function init() {
  setupFileUpload();
  setupCanvasEvents();
  setupControls();
  setupCrop();
  setupDemos();
  setupSideSwitching();
  setupCalibration();
  setupGuideModal();
  setupAnimationModal();
  setMode('simple'); // Default to simple mode
  updateSideUI();
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

// --- SIDE MANAGEMENT & UNION LOGIC ---

// Factory for preset box data
function createPresetBoxData(def, key = null) {
  return {
    id: 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    presetKey: key,
    x: def.x,
    y: def.y,
    width: def.width,
    height: def.height,
    label: def.label,
    style: state.activeStyle
  };
}

// Save active editing properties back to the corresponding side container
function saveCurrentSideState() {
  if (state.currentSide === 'both') return;
  const s = state.sides[state.currentSide];
  if (!s) return;

  // Protect against cold-start wipe: if state.img is null but side container already has an image, do not overwrite with null
  if (state.img === null && s.img !== null) {
    return;
  }

  s.img = state.img;
  s.imgOrientation = state.imgOrientation;
  s.fineRotation = state.fineRotation;
  s.originalImg = state.originalImg;
  s.originalOrientation = state.originalOrientation;
  s.hasCropped = state.hasCropped;
  s.boxes = state.boxes ? [...state.boxes] : [];
  s.calibration = state.calibration ? { ...state.calibration } : { topLeft: null, bottomRight: null };
}

// Switch between Front ('front'), Back ('back') and Union ('both')
function switchSide(newSide, force = false) {
  if (state.currentSide === newSide && !force) return;

  // 1. If currently in single-side editing, persist changes (unless forcing reload of the same side)
  if ((state.currentSide === 'front' || state.currentSide === 'back') && (!force || state.currentSide !== newSide)) {
    saveCurrentSideState();
    if (state.crop.active) exitCropMode();
    if (state.calibration.active) cancelCalibration();
  }

  state.currentSide = newSide;

  // 2. If entering 'front' or 'back', load its state into active editing
  if (newSide === 'front' || newSide === 'back') {
    const s = state.sides[newSide];
    state.img = s.img;
    state.imgOrientation = s.imgOrientation;
    state.fineRotation = s.fineRotation;
    state.originalImg = s.originalImg;
    state.originalOrientation = s.originalOrientation;
    state.hasCropped = s.hasCropped;
    state.boxes = s.boxes ? [...s.boxes] : [];
    state.calibration = s.calibration ? { ...s.calibration } : { topLeft: null, bottomRight: null };
    state.selectedBoxId = null;

    if (straightenSlider) straightenSlider.value = state.fineRotation || 0;
    if (straightenVal) straightenVal.textContent = `${state.fineRotation > 0 ? '+' : ''}${state.fineRotation || 0}°`;

    updateRestoreButton();

    // Auto-align preset tabs to match active side
    if (newSide === 'front' && presetTabs[0]) {
      presetTabs[0].click();
    } else if (newSide === 'back' && presetTabs[1]) {
      presetTabs[1].click();
    }
  }

  // 3. Synchronize UI indicators and re-render
  updateSideUI();
  updateBoxBadge();
  syncPresetButtonsState();
  render();
}

// Switch layout arrangement for merged document: 'vertical' | 'horizontal'
function setMergeLayout(layout) {
  state.mergeLayout = layout;
  mergeLayoutBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mergeLayout === layout);
  });
  if (state.currentSide === 'both') {
    render();
  }
}

// Update all UI elements (tabs, slot cards, badges, buttons) according to currentSide
function updateSideUI() {
  const side = state.currentSide;
  const isBoth = side === 'both';
  const hasFront = !!(state.sides.front && state.sides.front.img);
  const hasBack = !!(state.sides.back && state.sides.back.img);

  // Tab buttons in stage toolbar
  faceTabBtns.forEach(btn => {
    const active = btn.dataset.viewSide === side;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  // Segment buttons in Section 0 panel
  panelSideBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.side === side);
  });

  // Slot cards active indicator
  if (slotCardFront) slotCardFront.classList.toggle('active', side === 'front');
  if (slotCardBack) slotCardBack.classList.toggle('active', side === 'back');

  // Status badges on slot cards
  if (statusTagFront) {
    statusTagFront.textContent = hasFront ? '✓ Cargada' : 'Sin foto';
    statusTagFront.classList.toggle('status-loaded', hasFront);
  }
  if (statusTagBack) {
    statusTagBack.textContent = hasBack ? '✓ Cargada' : 'Sin foto';
    statusTagBack.classList.toggle('status-loaded', hasBack);
  }

  // Clear buttons on slot cards
  if (btnClearFront) btnClearFront.classList.toggle('hidden', !hasFront);
  if (btnClearBack) btnClearBack.classList.toggle('hidden', !hasBack);

  // Merge layout controls
  if (mergeLayoutPills) mergeLayoutPills.classList.toggle('hidden', !isBoth);
  if (mergeOptionsBox) mergeOptionsBox.classList.toggle('hidden', !isBoth && !(hasFront && hasBack));

  // Export target badge & download button text
  if (exportTargetBadge) {
    if (isBoth) {
      exportTargetBadge.textContent = 'Anverso + Reverso (Unión 2 en 1)';
    } else if (side === 'front') {
      exportTargetBadge.textContent = 'Anverso';
    } else {
      exportTargetBadge.textContent = 'Reverso';
    }
  }

  if (btnDownloadText) {
    if (isBoth) {
      btnDownloadText.textContent = 'Descargar Unión (2 en 1)';
    } else if (side === 'front') {
      btnDownloadText.textContent = 'Descargar Anverso';
    } else {
      btnDownloadText.textContent = 'Descargar Reverso';
    }
  }

  // Framing target label in Section 0
  if (framingTargetLabel) {
    if (isBoth) {
      framingTargetLabel.innerHTML = 'Ajustes para: <strong>Unión (2 en 1)</strong>';
    } else if (side === 'front') {
      framingTargetLabel.innerHTML = 'Ajustes para: <strong>Anverso</strong>';
    } else {
      framingTargetLabel.innerHTML = 'Ajustes para: <strong>Reverso</strong>';
    }
  }

  // Stage toolbar hint
  if (hintText) {
    if (isBoth) {
      hintText.innerHTML = '📄 <strong>Unión (2 en 1)</strong> · Toca cualquier cara para editarla individualmente';
    } else {
      hintText.innerHTML = '<strong>Arrastra</strong> para crear una zona oculta · <strong>Toca</strong> para mover o ajustar';
    }
  }

  // Disable single-image geometry tools when in union view
  if (btnCropToggle) {
    btnCropToggle.disabled = isBoth;
    btnCropToggle.style.opacity = isBoth ? '0.4' : '1';
    btnCropToggle.title = isBoth ? 'Selecciona Anverso o Reverso para recortar' : 'Recortar y encuadrar imagen';
  }
  if (btnRotateLeft) {
    btnRotateLeft.disabled = isBoth;
    btnRotateLeft.style.opacity = isBoth ? '0.4' : '1';
  }
  if (btnRotateRight) {
    btnRotateRight.disabled = isBoth;
    btnRotateRight.style.opacity = isBoth ? '0.4' : '1';
  }
  if (guidesToggleWrap) {
    guidesToggleWrap.style.display = isBoth ? 'none' : 'inline-flex';
  }

  // Visibility: Empty state vs Canvas wrapper
  const hasAnyImg = hasFront || hasBack || !!state.img;
  if (!hasAnyImg) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (canvasWrapper) canvasWrapper.classList.add('hidden');
    updateExportButtons(false);
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    if (canvasWrapper) canvasWrapper.classList.remove('hidden');
    updateExportButtons(true);
  }
}

// Load a single image file into a specific side
function loadSideFile(file, side, callback) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Por favor selecciona un archivo de imagen válido (JPG, PNG o WebP).', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const s = state.sides[side];
      s.img = img;
      s.imgOrientation = 0;
      s.fineRotation = 0;
      s.originalImg = null;
      s.originalOrientation = 0;
      s.hasCropped = false;
      s.boxes = [];
      s.calibration = { topLeft: null, bottomRight: null };

      // If active side is this side, sync active state as well
      if (state.currentSide === side) {
        state.img = img;
        state.imgOrientation = 0;
        state.fineRotation = 0;
        state.originalImg = null;
        state.originalOrientation = 0;
        state.hasCropped = false;
        state.boxes = [];
        state.selectedBoxId = null;
        if (straightenSlider) straightenSlider.value = 0;
        if (straightenVal) straightenVal.textContent = '0°';
        exitCropMode();
        resetCalibration();
        updateRestoreButton();
      }

      updateSideUI();
      if (callback) {
        callback();
      } else {
        render();
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// Handle single or multiple file uploads
function handleFiles(files) {
  if (!files || files.length === 0) return;

  if (files.length >= 2) {
    // Dual upload: File 0 = Front, File 1 = Back -> Auto switch to union view!
    loadSideFile(files[0], 'front', () => {
      loadSideFile(files[1], 'back', () => {
        switchSide('both');
      });
    });
  } else {
    // Single file upload
    let target = state.currentSide;
    if (target === 'both') {
      target = !state.sides.front.img ? 'front' : (!state.sides.back.img ? 'back' : 'front');
    }
    loadSideFile(files[0], target, () => {
      switchSide(target);
    });
  }
}

// Setup side switching listeners and file inputs
function setupSideSwitching() {
  // Stage toolbar tabs
  faceTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.viewSide;
      if (side) switchSide(side);
    });
  });

  // Panel segmented buttons
  panelSideBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.side;
      if (side) switchSide(side);
    });
  });

  // Layout arrangement pills
  mergeLayoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.mergeLayout;
      if (layout) setMergeLayout(layout);
    });
  });

  // Slot card clicks
  if (slotCardFront) {
    slotCardFront.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button') || e.target.closest('label')) return;
      switchSide('front');
    });
  }
  if (slotCardBack) {
    slotCardBack.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button') || e.target.closest('label')) return;
      switchSide('back');
    });
  }

  // Individual file inputs
  if (fileInputFront) {
    fileInputFront.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadSideFile(e.target.files[0], 'front', () => switchSide('front'));
      }
    });
  }
  if (fileInputBack) {
    fileInputBack.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadSideFile(e.target.files[0], 'back', () => switchSide('back'));
      }
    });
  }

  // Clear buttons
  if (btnClearFront) {
    btnClearFront.addEventListener('click', (e) => {
      e.stopPropagation();
      state.sides.front = createSideState();
      if (state.currentSide === 'front') {
        state.img = null;
        state.boxes = [];
        state.selectedBoxId = null;
      }
      updateSideUI();
      render();
    });
  }
  if (btnClearBack) {
    btnClearBack.addEventListener('click', (e) => {
      e.stopPropagation();
      state.sides.back = createSideState();
      if (state.currentSide === 'back') {
        state.img = null;
        state.boxes = [];
        state.selectedBoxId = null;
      }
      updateSideUI();
      render();
    });
  }
}

function setupFileUpload() {
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
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
    if (dt && dt.files && dt.files.length > 0) {
      handleFiles(dt.files);
    }
  });

  // Paste from clipboard support
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (let item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        files.push(item.getAsFile());
      }
    }
    if (files.length > 0) {
      handleFiles(files);
    }
  });
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

      const isFrontPreset = ['firma', 'can', 'soporte', 'validez', 'nacimiento', 'foto_extra'].includes(key);
      const targetSide = isFrontPreset ? 'front' : 'back';

      if (state.currentSide === 'both') {
        switchSide(targetSide);
      } else if (state.currentSide !== targetSide) {
        switchSide(targetSide);
      }

      if (!state.img) {
        showToast('Carga primero una foto para esta cara o prueba con el ejemplo.', 'info');
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

  // Recommended button (AEPD & Police recommended: Signature + CAN + Support # on Front, MRZ + Address on Back)
  const applyRecommended = () => {
    // If in 'both' mode, apply recommendations across both sides
    if (state.currentSide === 'both') {
      const front = state.sides.front;
      const back = state.sides.back;
      if (!front.img && !back.img) {
        showToast('Carga al menos una foto de tu DNI para proteger ambas caras.', 'info');
        return;
      }
      const recFront = ['soporte', 'firma', 'can'];
      const recBack = ['mrz', 'domicilio'];

      if (front.img) {
        recFront.forEach(k => {
          if (!front.boxes.some(b => b.presetKey === k) && PRESETS[k]) {
            front.boxes.push(createPresetBoxData(PRESETS[k], k));
          }
        });
      }
      if (back.img) {
        recBack.forEach(k => {
          if (!back.boxes.some(b => b.presetKey === k) && PRESETS[k]) {
            back.boxes.push(createPresetBoxData(PRESETS[k], k));
          }
        });
      }
      updateBoxBadge();
      syncPresetButtonsState();
      render();
      return;
    }

    if (!state.img) {
      showToast('ℹ️ Primero sube una foto de tu DNI para poder protegerla.', 'info');
      return;
    }
    
    const recKeys = state.currentSide === 'back' ? ['mrz', 'domicilio'] : ['soporte', 'firma', 'can'];
    const allActive = recKeys.every(k => state.boxes.some(b => b.presetKey === k));
    
    if (allActive) {
      // Remove all recommended for this side
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
    if (state.img || (state.sides.front.img || state.sides.back.img)) {
      applyRecommended();
    } else {
      loadDemoBoth();
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
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.wmText = btn.dataset.text;
      wmTextInput.value = state.wmText;
      if (state.appMode === 'simple' && state.img && state.boxes.length === 0) {
        applyRecommended();
      }
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

  // Rotation & Straighten controls
  if (btnRotate) btnRotate.addEventListener('click', () => rotateBy(90));
  if (btnRotateRight) btnRotateRight.addEventListener('click', () => rotateBy(90));
  if (btnRotateLeft) btnRotateLeft.addEventListener('click', () => rotateBy(-90));
  if (btnPanelRotRight) btnPanelRotRight.addEventListener('click', () => rotateBy(90));
  if (btnPanelRotLeft) btnPanelRotLeft.addEventListener('click', () => rotateBy(-90));

  if (straightenSlider) {
    straightenSlider.addEventListener('input', (e) => {
      state.fineRotation = parseFloat(e.target.value);
      if (straightenVal) straightenVal.textContent = state.fineRotation + '°';
      render();
    });
  }

  if (btnResetStraighten) {
    btnResetStraighten.addEventListener('click', () => {
      state.fineRotation = 0;
      if (straightenSlider) straightenSlider.value = 0;
      if (straightenVal) straightenVal.textContent = '0°';
      render();
    });
  }

  // Show guides toggle
  showGuidesCheckbox.addEventListener('change', (e) => {
    state.showGuides = e.target.checked;
    render();
  });

  // Download & Copy
  btnDownload.addEventListener('click', downloadProtectedImage);
  btnCopyClipboard.addEventListener('click', copyToClipboard);

  const btnStep3Download = document.getElementById('btn-step3-download');
  const btnStep3Copy = document.getElementById('btn-step3-copy');
  if (btnStep3Download) {
    btnStep3Download.addEventListener('click', downloadProtectedImage);
  }
  if (btnStep3Copy) {
    btnStep3Copy.addEventListener('click', copyToClipboard);
  }

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedBoxId && !state.crop.active) {
        e.preventDefault();
        deleteSelectedBox();
      }
    } else if (e.key === 'Enter') {
      if (state.crop.active) {
        e.preventDefault();
        applyCrop();
      }
    } else if (e.key === 'Escape') {
      if (state.crop.active) {
        exitCropMode();
      } else if (state.calibration.active) {
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
  const btnStep3Download = document.getElementById('btn-step3-download');
  const btnStep3Copy = document.getElementById('btn-step3-copy');
  if (btnStep3Download) btnStep3Download.disabled = !enabled;
  if (btnStep3Copy) btnStep3Copy.disabled = !enabled;
}

function updateBoxBadge() {
  let count = state.boxes.length;
  if (state.currentSide === 'both') {
    count = (state.sides.front.boxes ? state.sides.front.boxes.length : 0) +
            (state.sides.back.boxes ? state.sides.back.boxes.length : 0);
  }
  boxCountBadge.textContent = count === 1 ? '1 zona oculta' : `${count} zonas ocultas`;
}

// Add preset box applying calibration transformation if available
// Sync the visual active state of preset buttons with current boxes
function syncPresetButtonsState() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    const key = btn.dataset.preset;
    let isPresent = false;
    if (state.currentSide === 'both') {
      const inFront = state.sides.front.boxes && state.sides.front.boxes.some(b => b.presetKey === key);
      const inBack = state.sides.back.boxes && state.sides.back.boxes.some(b => b.presetKey === key);
      isPresent = inFront || inBack;
    } else {
      isPresent = state.boxes.some(b => b.presetKey === key);
    }
    btn.classList.toggle('active', isPresent);
  });

  // Also check if AEPD button is active
  if (btnRecommendAEPD) {
    if (state.currentSide === 'both') {
      const recFront = ['soporte', 'firma', 'can'];
      const recBack = ['mrz', 'domicilio'];
      const frontActive = !state.sides.front.img || recFront.every(k => state.sides.front.boxes.some(b => b.presetKey === k));
      const backActive = !state.sides.back.img || recBack.every(k => state.sides.back.boxes.some(b => b.presetKey === k));
      const hasAny = !!(state.sides.front.img || state.sides.back.img);
      btnRecommendAEPD.classList.toggle('active', hasAny && frontActive && backActive);
    } else {
      const recKeys = state.currentSide === 'back' ? ['mrz', 'domicilio'] : ['soporte', 'firma', 'can'];
      const allActive = recKeys.every(k => state.boxes.some(b => b.presetKey === k));
      btnRecommendAEPD.classList.toggle('active', allActive);
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
      showToast('Carga primero una foto de tu DNI para calibrar esquinas.', 'info');
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
  btnDemoFront.addEventListener('click', () => loadDemoSide('Spanish_ID_card_(front_side).webp', 'front'));
  btnDemoBack.addEventListener('click', () => loadDemoSide('back.jpg', 'back'));
  if (btnDemoFrontThumb) {
    btnDemoFrontThumb.addEventListener('click', () => loadDemoSide('Spanish_ID_card_(front_side).webp', 'front'));
  }
  if (btnDemoBackThumb) {
    btnDemoBackThumb.addEventListener('click', () => loadDemoSide('back.jpg', 'back'));
  }

  // Dual demo buttons (Load both Carmen front & back into a 2-in-1 union)
  if (btnDemoBoth) {
    btnDemoBoth.addEventListener('click', loadDemoBoth);
  }
  if (btnDemoBothThumb) {
    btnDemoBothThumb.addEventListener('click', loadDemoBoth);
  }
}

// Load a single demo side with recommended presets
function loadDemoSide(imagePath, side) {
  const img = new Image();
  img.onload = () => {
    const s = state.sides[side];
    s.img = img;
    s.imgOrientation = 0;
    s.fineRotation = 0;
    s.originalImg = null;
    s.originalOrientation = 0;
    s.hasCropped = false;
    s.calibration = { topLeft: null, bottomRight: null };

    if (side === 'front') {
      s.boxes = [
        createPresetBoxData(PRESETS.soporte, 'soporte'),
        createPresetBoxData(PRESETS.firma, 'firma'),
        createPresetBoxData(PRESETS.can, 'can')
      ];
    } else {
      s.boxes = [
        createPresetBoxData(PRESETS.mrz, 'mrz'),
        createPresetBoxData(PRESETS.domicilio, 'domicilio')
      ];
    }

    switchSide(side, true);
  };
  img.src = imagePath;
}

// Load both Carmen front & back simultaneously and show union view
function loadDemoBoth() {
  let loaded = 0;
  const frontImg = new Image();
  const backImg = new Image();

  const onLoaded = () => {
    loaded++;
    if (loaded < 2) return;

    // 1. Setup Front
    state.sides.front.img = frontImg;
    state.sides.front.imgOrientation = 0;
    state.sides.front.fineRotation = 0;
    state.sides.front.originalImg = null;
    state.sides.front.originalOrientation = 0;
    state.sides.front.hasCropped = false;
    state.sides.front.calibration = { topLeft: null, bottomRight: null };
    state.sides.front.boxes = [
      createPresetBoxData(PRESETS.soporte, 'soporte'),
      createPresetBoxData(PRESETS.firma, 'firma'),
      createPresetBoxData(PRESETS.can, 'can')
    ];

    // 2. Setup Back
    state.sides.back.img = backImg;
    state.sides.back.imgOrientation = 0;
    state.sides.back.fineRotation = 0;
    state.sides.back.originalImg = null;
    state.sides.back.originalOrientation = 0;
    state.sides.back.hasCropped = false;
    state.sides.back.calibration = { topLeft: null, bottomRight: null };
    state.sides.back.boxes = [
      createPresetBoxData(PRESETS.mrz, 'mrz'),
      createPresetBoxData(PRESETS.domicilio, 'domicilio')
    ];

    // Synchronize active editing state with front card before switching to union view
    state.img = frontImg;
    state.boxes = [...state.sides.front.boxes];

    // 3. Switch directly to union view
    switchSide('both');
  };

  frontImg.onload = onLoaded;
  backImg.onload = onLoaded;

  frontImg.src = 'Spanish_ID_card_(front_side).webp';
  backImg.src = 'back.jpg';
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

  const modalBody = guideModal.querySelector('.modal-body');

  // Highlight specific item if triggered from chip info
  document.querySelectorAll('.guide-item').forEach(item => item.classList.remove('highlighted'));
  if (targetId) {
    const el = document.getElementById('guide-item-' + targetId);
    if (el) {
      el.classList.add('highlighted');
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  } else if (modalBody) {
    modalBody.scrollTop = 0;
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

  // If in union mode (both sides), delegate to composite document renderer
  if (state.currentSide === 'both') {
    renderMergedDocument(forExport);
    return;
  }

  // 1. Draw base image with orientation & fine tilt
  ctx.save();
  ctx.translate(baseW / 2, baseH / 2);
  const totalAngle = (state.imgOrientation + state.fineRotation) * (Math.PI / 180);
  ctx.rotate(totalAngle);
  ctx.drawImage(
    state.img,
    -state.img.width / 2,
    -state.img.height / 2,
    state.img.width,
    state.img.height
  );
  ctx.restore();

  // If crop is active, skip filters for preview so user sees raw photo clearly
  if (!state.crop.active) {
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
  }

  // 5. Draw UI Handles, Guides and Calibration markers (Only in live editor)
  if (!forExport) {
    if (state.crop.active) {
      drawCropOverlay(baseW, baseH);
    } else {
      if (state.showGuides) {
        drawEditorGuides(baseW, baseH);
      }
      if (state.calibration.active || state.calibration.topLeft) {
        drawCalibrationMarkers(baseW, baseH);
      }
    }
  }

  ctx.restore();
}

// Render a single side card onto an offscreen canvas with its rotation and obfuscations
function renderCardToOffscreen(sideData) {
  if (!sideData || !sideData.img) return null;

  const img = sideData.img;
  const isRotated = sideData.imgOrientation === 90 || sideData.imgOrientation === 270;
  const w = isRotated ? img.height : img.width;
  const h = isRotated ? img.width : img.height;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const offCtx = off.getContext('2d', { willReadFrequently: true });

  offCtx.save();
  offCtx.translate(w / 2, h / 2);
  const totalAngle = (sideData.imgOrientation + (sideData.fineRotation || 0)) * (Math.PI / 180);
  offCtx.rotate(totalAngle);
  offCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  offCtx.restore();

  if (sideData.boxes && sideData.boxes.length > 0) {
    applyObfuscationBoxes(w, h, sideData.boxes, off, offCtx);
  }

  return off;
}

// Render composite document combining Front and Back in a single canvas
function renderMergedDocument(forExport = false) {
  saveCurrentSideState();

  const frontCanvas = renderCardToOffscreen(state.sides.front);
  const backCanvas = renderCardToOffscreen(state.sides.back);

  if (!frontCanvas && !backCanvas) {
    emptyState.classList.remove('hidden');
    canvasWrapper.classList.add('hidden');
    updateExportButtons(false);
    return;
  }

  emptyState.classList.add('hidden');
  canvasWrapper.classList.remove('hidden');
  updateExportButtons(true);

  const pad = 60;
  const gap = 48;
  const headerH = 32;

  if (state.mergeLayout === 'vertical') {
    const CARD_W = 1200;
    let fW = CARD_W;
    let fH = Math.round(CARD_W / 1.58577);
    let bW = CARD_W;
    let bH = Math.round(CARD_W / 1.58577);

    if (frontCanvas) {
      fH = Math.round(frontCanvas.height * (CARD_W / frontCanvas.width));
    }
    if (backCanvas) {
      bH = Math.round(backCanvas.height * (CARD_W / backCanvas.width));
    }

    const totalW = CARD_W + pad * 2;
    const totalH = pad * 2 + (headerH + fH) + gap + (headerH + bH);

    if (canvas.width !== totalW || canvas.height !== totalH) {
      canvas.width = totalW;
      canvas.height = totalH;
    }

    ctx.save();
    // Clean white document sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);

    const fX = pad;
    const fY = pad + headerH;
    const bX = pad;
    const bY = fY + fH + gap + headerH;

    state.lastMergedBounds = {
      frontRect: { x: fX, y: fY, w: fW, h: fH },
      backRect: { x: bX, y: bY, w: bW, h: bH }
    };

    drawMergedCardHeader('🪪 ANVERSO', fX, pad + 16);
    if (frontCanvas) {
      drawCardWithBorder(frontCanvas, fX, fY, fW, fH);
    } else {
      drawCardPlaceholder('Haz clic aquí para cargar el Anverso', fX, fY, fW, fH);
    }

    drawMergedCardHeader('🔄 REVERSO', bX, fY + fH + gap + 16);
    if (backCanvas) {
      drawCardWithBorder(backCanvas, bX, bY, bW, bH);
    } else {
      drawCardPlaceholder('Haz clic aquí para cargar el Reverso', bX, bY, bW, bH);
    }

  } else {
    // Horizontal layout (Side-by-side)
    const CARD_H = 750;
    let fW = Math.round(CARD_H * 1.58577);
    let bW = Math.round(CARD_H * 1.58577);

    if (frontCanvas) {
      fW = Math.round(frontCanvas.width * (CARD_H / frontCanvas.height));
    }
    if (backCanvas) {
      bW = Math.round(backCanvas.width * (CARD_H / backCanvas.height));
    }

    const totalW = pad * 2 + fW + gap + bW;
    const totalH = pad * 2 + headerH + CARD_H;

    if (canvas.width !== totalW || canvas.height !== totalH) {
      canvas.width = totalW;
      canvas.height = totalH;
    }

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);

    const fX = pad;
    const fY = pad + headerH;
    const bX = fX + fW + gap;
    const bY = pad + headerH;

    state.lastMergedBounds = {
      frontRect: { x: fX, y: fY, w: fW, h: CARD_H },
      backRect: { x: bX, y: bY, w: bW, h: CARD_H }
    };

    drawMergedCardHeader('🪪 ANVERSO', fX, pad + 16);
    if (frontCanvas) {
      drawCardWithBorder(frontCanvas, fX, fY, fW, CARD_H);
    } else {
      drawCardPlaceholder('Haz clic aquí para cargar el Anverso', fX, fY, fW, CARD_H);
    }

    drawMergedCardHeader('🔄 REVERSO', bX, pad + 16);
    if (backCanvas) {
      drawCardWithBorder(backCanvas, bX, bY, bW, CARD_H);
    } else {
      drawCardPlaceholder('Haz clic aquí para cargar el Reverso', bX, bY, bW, CARD_H);
    }
  }

  // Security filters over the unified composite sheet
  if (state.bwEnabled) {
    applyBlackAndWhiteFilter(canvas.width, canvas.height, ctx);
  }
  if (state.wmEnabled && state.wmText.trim() !== '') {
    applyWatermark(canvas.width, canvas.height, ctx);
  }

  // Interactive helper badge overlay in live view
  if (!forExport) {
    drawMergedLiveGuides();
  }

  ctx.restore();
}

function drawCardWithBorder(sourceCanvas, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(sourceCanvas, x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawCardPlaceholder(msg, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, x + w / 2, y + h / 2);
  ctx.restore();
}

function drawMergedCardHeader(label, x, y) {
  ctx.save();
  ctx.font = 'bold 18px -apple-system, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawMergedLiveGuides() {
  if (!state.lastMergedBounds) return;
  const { frontRect, backRect } = state.lastMergedBounds;

  const drawGuidePill = (rect, label) => {
    ctx.save();
    ctx.font = 'bold 12px -apple-system, sans-serif';
    const text = `✎ Clic para editar ${label}`;
    const tm = ctx.measureText(text);
    const pillW = tm.width + 20;
    const pillH = 26;
    const px = rect.x + rect.w - pillW - 12;
    const py = rect.y + 12;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(px, py, pillW, pillH, 6);
    } else {
      ctx.fillRect(px, py, pillW, pillH);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px + 10, py + pillH / 2);
    ctx.restore();
  };

  if (state.sides.front && state.sides.front.img) drawGuidePill(frontRect, 'Anverso');
  if (state.sides.back && state.sides.back.img) drawGuidePill(backRect, 'Reverso');
}

// --- FILTER: OBFUSCATION ---
function applyObfuscationBoxes(width, height, targetBoxes = state.boxes, targetCanvas = canvas, targetCtx = ctx) {
  targetBoxes.forEach(box => {
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
      targetCtx.fillStyle = '#0a0a0a';
      targetCtx.fillRect(x, y, w, h);
    } else if (style === 'pixelate') {
      const blockSize = Math.max(6, Math.round(state.intensity * (width / 900)));
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const smallW = Math.max(1, Math.floor(w / blockSize));
      const smallH = Math.max(1, Math.floor(h / blockSize));

      tempCanvas.width = smallW;
      tempCanvas.height = smallH;
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(targetCanvas, x, y, w, h, 0, 0, smallW, smallH);

      targetCtx.save();
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(tempCanvas, 0, 0, smallW, smallH, x, y, w, h);
      targetCtx.restore();
    } else if (style === 'blur') {
      const blurRadius = Math.max(4, Math.round(state.intensity * (width / 1100)));
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = w;
      tempCanvas.height = h;

      tempCtx.filter = `blur(${blurRadius}px)`;
      tempCtx.drawImage(targetCanvas, x, y, w, h, 0, 0, w, h);

      targetCtx.drawImage(tempCanvas, x, y);
    }
  });
}

// --- FILTER: BLACK & WHITE + CONTRAST & BRIGHTNESS ---
function applyBlackAndWhiteFilter(width, height, targetCtx = ctx) {
  const imgData = targetCtx.getImageData(0, 0, width, height);
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

  targetCtx.putImageData(imgData, 0, 0);
}

// --- FILTER: WATERMARK ---
function applyWatermark(width, height, targetCtx = ctx) {
  let text = state.wmText.trim();
  if (state.wmIncludeDate) {
    text += ` · ${todayStr}`;
  }

  targetCtx.save();
  const opacity = state.wmOpacity / 100;
  targetCtx.globalAlpha = opacity;

  const baseFontSize = Math.max(14, Math.round((width / 42) * (state.wmScale / 100)));
  targetCtx.font = `bold ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  targetCtx.textBaseline = 'middle';
  targetCtx.textAlign = 'center';

  const mode = state.wmMode;
  const color = state.wmColor;

  if (mode === 'tiled') {
    const angle = -28 * (Math.PI / 180);
    const textMetrics = targetCtx.measureText(text);
    const textWidth = textMetrics.width;
    const stepX = Math.max(textWidth + 80, 220);
    const stepY = baseFontSize * 3.8;

    targetCtx.translate(width / 2, height / 2);
    targetCtx.rotate(angle);

    const diag = Math.hypot(width, height);
    const startX = -diag;
    const endX = diag;
    const startY = -diag;
    const endY = diag;

    let rowIndex = 0;
    for (let y = startY; y < endY; y += stepY) {
      const offsetX = (rowIndex % 2 === 0) ? 0 : stepX / 2;
      for (let x = startX; x < endX; x += stepX) {
        drawWatermarkText(text, x + offsetX, y, color, baseFontSize, targetCtx);
      }
      rowIndex++;
    }
  } else if (mode === 'single') {
    const angle = -24 * (Math.PI / 180);
    targetCtx.translate(width / 2, height / 2);
    targetCtx.rotate(angle);

    const stampFontSize = Math.round(baseFontSize * 1.5);
    targetCtx.font = `900 ${stampFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    
    const tm = targetCtx.measureText(text);
    const pad = stampFontSize * 0.5;
    targetCtx.lineWidth = Math.max(3, stampFontSize / 12);
    targetCtx.strokeStyle = color;
    targetCtx.strokeRect(-tm.width / 2 - pad, -stampFontSize * 0.9, tm.width + pad * 2, stampFontSize * 1.8);

    drawWatermarkText(text, 0, 0, color, stampFontSize, targetCtx);
  } else if (mode === 'banner') {
    const ribbonH = baseFontSize * 2;
    drawRibbon(0, height * 0.22, width, ribbonH, text, color, baseFontSize, targetCtx);
    drawRibbon(0, height * 0.72, width, ribbonH, text, color, baseFontSize, targetCtx);
  }

  targetCtx.restore();
}

function drawWatermarkText(text, x, y, color, fontSize, targetCtx = ctx) {
  targetCtx.lineJoin = 'round';
  targetCtx.miterLimit = 2;
  targetCtx.strokeStyle = color === '#ffffff' ? '#000000' : '#ffffff';
  targetCtx.lineWidth = Math.max(2, fontSize / 8);
  targetCtx.strokeText(text, x, y);

  targetCtx.fillStyle = color;
  targetCtx.fillText(text, x, y);
}

function drawRibbon(rx, ry, rw, rh, text, color, fontSize, targetCtx = ctx) {
  targetCtx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  targetCtx.fillRect(rx, ry - rh / 2, rw, rh);
  drawWatermarkText(text, rw / 2, ry, color, fontSize, targetCtx);
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
      const rect = canvas.getBoundingClientRect();
      const scaleFactor = (rect && rect.width > 0) ? (canvas.width / rect.width) : 1;
      const curHandleSize = Math.max(12, Math.ceil(14 * scaleFactor));

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(2, Math.round(2 * scaleFactor));
      ctx.setLineDash([]);

      const corners = [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h }
      ];

      corners.forEach(pt => {
        ctx.fillRect(pt.x - curHandleSize / 2, pt.y - curHandleSize / 2, curHandleSize, curHandleSize);
        ctx.strokeRect(pt.x - curHandleSize / 2, pt.y - curHandleSize / 2, curHandleSize, curHandleSize);
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
    const rect = canvas.getBoundingClientRect();
    const scaleFactor = (rect && rect.width > 0) ? (canvas.width / rect.width) : 1;
    const tol = Math.max(18, Math.ceil(24 * scaleFactor));

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

  // Expose display-scale hit tolerance and handle size calculations for diagnostics and tests
  window.getCanvasHitTolerance = (scaleFactor) => Math.max(18, Math.ceil(24 * scaleFactor));
  window.getCanvasHandleSize = (scaleFactor) => Math.max(12, Math.ceil(14 * scaleFactor));

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
    try {
      if (canvas.setPointerCapture && e && e.pointerId !== undefined) {
        canvas.setPointerCapture(e.pointerId);
      }
    } catch (err) {}
    const coords = getCanvasCoords(e);
    const px = coords.x;
    const py = coords.y;

    // Interactive navigation when viewing Union (both sides)
    if (state.currentSide === 'both') {
      if (state.lastMergedBounds) {
        const { frontRect, backRect } = state.lastMergedBounds;
        if (px >= frontRect.x && px <= frontRect.x + frontRect.w &&
            py >= frontRect.y && py <= frontRect.y + frontRect.h) {
          if (!state.sides.front.img) {
            fileInputFront.click();
          } else {
            switchSide('front');
          }
          return;
        }
        if (px >= backRect.x && px <= backRect.x + backRect.w &&
            py >= backRect.y && py <= backRect.y + backRect.h) {
          if (!state.sides.back.img) {
            fileInputBack.click();
          } else {
            switchSide('back');
          }
          return;
        }
      }
      return;
    }

    if (!state.img) return;

    // If calibration is active, record calibration point and return
    if (state.calibration.active) {
      handleCalibrationClick(px / canvas.width, py / canvas.height);
      return;
    }

    // Crop Interaction
    if (state.crop.active) {
      const w = canvas.width;
      const h = canvas.height;
      const cr = state.crop.rect;
      const rx = cr.x * w;
      const ry = cr.y * h;
      const rw = cr.width * w;
      const rh = cr.height * h;
      const tol = 20;

      const cropHandles = {
        nw: Math.hypot(px - rx, py - ry) < tol,
        ne: Math.hypot(px - (rx + rw), py - ry) < tol,
        se: Math.hypot(px - (rx + rw), py - (ry + rh)) < tol,
        sw: Math.hypot(px - rx, py - (ry + rh)) < tol,
        n: Math.abs(py - ry) < tol && px >= rx - tol && px <= rx + rw + tol,
        s: Math.abs(py - (ry + rh)) < tol && px >= rx - tol && px <= rx + rw + tol,
        w: Math.abs(px - rx) < tol && py >= ry - tol && py <= ry + rh + tol,
        e: Math.abs(px - (rx + rw)) < tol && py >= ry - tol && py <= ry + rh + tol
      };

      for (let k in cropHandles) {
        if (cropHandles[k]) {
          state.crop.handle = k;
          state.crop.dragStart = { x: px, y: py };
          state.crop.origRect = { ...cr };
          return;
        }
      }

      // Check click inside crop frame to move it
      if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) {
        state.crop.handle = 'move';
        state.crop.dragStart = { x: px, y: py };
        state.crop.origRect = { ...cr };
        return;
      }
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
    const coords = getCanvasCoords(e);
    const px = coords.x;
    const py = coords.y;

    if (state.currentSide === 'both') {
      if (state.lastMergedBounds) {
        const { frontRect, backRect } = state.lastMergedBounds;
        const inFront = px >= frontRect.x && px <= frontRect.x + frontRect.w && py >= frontRect.y && py <= frontRect.y + frontRect.h;
        const inBack = px >= backRect.x && px <= backRect.x + backRect.w && py >= backRect.y && py <= backRect.y + backRect.h;
        canvas.style.cursor = (inFront || inBack) ? 'pointer' : 'default';
      }
      return;
    }

    if (!state.img || state.calibration.active) return;

    // Crop Interaction on Move
    if (state.crop.active) {
      const w = canvas.width;
      const h = canvas.height;
      const cr = state.crop.rect;
      const rx = cr.x * w;
      const ry = cr.y * h;
      const rw = cr.width * w;
      const rh = cr.height * h;
      const tol = 20;

      if (!state.crop.handle) {
        if (Math.hypot(px - rx, py - ry) < tol || Math.hypot(px - (rx + rw), py - (ry + rh)) < tol) {
          canvas.style.cursor = 'nwse-resize';
        } else if (Math.hypot(px - (rx + rw), py - ry) < tol || Math.hypot(px - rx, py - (ry + rh)) < tol) {
          canvas.style.cursor = 'nesw-resize';
        } else if ((Math.abs(py - ry) < tol || Math.abs(py - (ry + rh)) < tol) && px >= rx - tol && px <= rx + rw + tol) {
          canvas.style.cursor = 'ns-resize';
        } else if ((Math.abs(px - rx) < tol || Math.abs(px - (rx + rw)) < tol) && py >= ry - tol && py <= ry + rh + tol) {
          canvas.style.cursor = 'ew-resize';
        } else if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'default';
        }
        return;
      }

      const orig = state.crop.origRect;
      const dx = (px - state.crop.dragStart.x) / w;
      const dy = (py - state.crop.dragStart.y) / h;
      const handle = state.crop.handle;

      if (handle === 'move') {
        cr.x = Math.max(0, Math.min(1 - orig.width, orig.x + dx));
        cr.y = Math.max(0, Math.min(1 - orig.height, orig.y + dy));
        render();
        return;
      }

      let newX = orig.x;
      let newY = orig.y;
      let newW = orig.width;
      let newH = orig.height;
      const minNorm = 0.05;

      if (handle.includes('e')) {
        newW = Math.max(minNorm, Math.min(1 - orig.x, orig.width + dx));
      } else if (handle.includes('w')) {
        newW = Math.max(minNorm, orig.width - dx);
        newX = orig.x + (orig.width - newW);
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
      }

      if (handle.includes('s')) {
        newH = Math.max(minNorm, Math.min(1 - orig.y, orig.height + dy));
      } else if (handle.includes('n')) {
        newH = Math.max(minNorm, orig.height - dy);
        newY = orig.y + (orig.height - newH);
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
      }

      if (state.crop.ratio === 'dni') {
        const targetAspect = DNI_ASPECT_RATIO;
        if (handle === 'n' || handle === 's') {
          newW = Math.min(1 - newX, (newH * h * targetAspect) / w);
        } else {
          newH = Math.min(1 - newY, (newW * w) / (targetAspect * h));
        }
      } else if (state.crop.ratio === '1:1') {
        if (handle === 'n' || handle === 's') {
          newW = Math.min(1 - newX, (newH * h) / w);
        } else {
          newH = Math.min(1 - newY, (newW * w) / h);
        }
      }

      cr.x = Math.max(0, Math.min(1 - minNorm, newX));
      cr.y = Math.max(0, Math.min(1 - minNorm, newY));
      cr.width = Math.max(minNorm, Math.min(1 - cr.x, newW));
      cr.height = Math.max(minNorm, Math.min(1 - cr.y, newH));

      render();
      return;
    }

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
  const handlePointerEnd = (e) => {
    try {
      if (canvas.releasePointerCapture && e && e.pointerId !== undefined && canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
    if (state.crop.active) {
      state.crop.handle = null;
      return;
    }
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
  if (state.currentSide === 'both') {
    if (!state.sides.front.img && !state.sides.back.img) return;
  } else {
    if (!state.img) return;
  }

  render(true);

  const format = exportFormat.value;
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const quality = format === 'image/jpeg' ? 0.92 : undefined;

  let sideTag = 'Anverso';
  if (state.currentSide === 'both') {
    sideTag = 'Completo_Anverso_y_Reverso';
  } else if (state.currentSide === 'back') {
    sideTag = 'Reverso';
  }

  const dataUrl = canvas.toDataURL(format, quality);
  const link = document.createElement('a');
  link.download = `DNI_${sideTag}_Protegido_${Date.now()}.${ext}`;
  link.href = dataUrl;
  link.click();

  render(false);
}

async function copyToClipboard() {
  if (state.currentSide === 'both') {
    if (!state.sides.front.img && !state.sides.back.img) return;
  } else {
    if (!state.img) return;
  }

  if (!navigator.clipboard || !window.ClipboardItem) {
    showToast('Tu navegador no admite copiar imágenes directamente al portapapeles. Usa el botón "Descargar".', 'warning');
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
      const btnStep3Copy = document.getElementById('btn-step3-copy');
      const prevStep3Text = btnStep3Copy ? btnStep3Copy.textContent : '';
      if (btnStep3Copy) btnStep3Copy.textContent = '✓ ¡Copiado!';
      showToast('✓ Imagen copiada al portapapeles', 'success');
      setTimeout(() => {
        btnCopyClipboard.textContent = prevText;
        if (btnStep3Copy) btnStep3Copy.textContent = prevStep3Text;
      }, 2000);
    }, 'image/png');
  } catch (err) {
    console.error('Clipboard error:', err);
    showToast('No se pudo copiar al portapapeles. Usa el botón Descargar.', 'warning');
  } finally {
    render(false);
  }
}

// --- ROTATION & STRAIGHTEN TOOLS ---
function rotateBy(degrees) {
  if (!state.img) return;

  if (degrees === 90) {
    state.imgOrientation = (state.imgOrientation + 90) % 360;
    // Transform boxes: (x, y, w, h) -> (1 - (y + h), x, h, w)
    state.boxes = state.boxes.map(b => ({
      ...b,
      x: Math.max(0, Math.min(1 - b.height, 1 - (b.y + b.height))),
      y: Math.max(0, Math.min(1 - b.width, b.x)),
      width: b.height,
      height: b.width
    }));
    if (state.calibration.topLeft && state.calibration.bottomRight) {
      const tl = state.calibration.topLeft;
      const br = state.calibration.bottomRight;
      const p1 = { x: 1 - tl.y, y: tl.x };
      const p2 = { x: 1 - br.y, y: br.x };
      state.calibration.topLeft = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
      state.calibration.bottomRight = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
    }
  } else if (degrees === -90) {
    state.imgOrientation = (state.imgOrientation + 270) % 360;
    // Transform boxes: (x, y, w, h) -> (y, 1 - (x + w), h, w)
    state.boxes = state.boxes.map(b => ({
      ...b,
      x: Math.max(0, Math.min(1 - b.height, b.y)),
      y: Math.max(0, Math.min(1 - b.width, 1 - (b.x + b.width))),
      width: b.height,
      height: b.width
    }));
    if (state.calibration.topLeft && state.calibration.bottomRight) {
      const tl = state.calibration.topLeft;
      const br = state.calibration.bottomRight;
      const p1 = { x: tl.y, y: 1 - tl.x };
      const p2 = { x: br.y, y: 1 - br.x };
      state.calibration.topLeft = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
      state.calibration.bottomRight = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
    }
  }

  if (state.crop.active) {
    resetCropRect();
  }
  render();
}

// --- CROPPING MODULE ---
const DNI_ASPECT_RATIO = 85.6 / 53.98; // ~1.58577 (ISO/IEC 7810 ID-1 standard)

function setupCrop() {
  if (btnCropToggle) btnCropToggle.addEventListener('click', toggleCropMode);
  if (btnPanelCrop) btnPanelCrop.addEventListener('click', toggleCropMode);
  if (btnApplyCrop) btnApplyCrop.addEventListener('click', applyCrop);
  if (btnCancelCrop) btnCancelCrop.addEventListener('click', exitCropMode);
  if (btnResetCropBox) btnResetCropBox.addEventListener('click', resetCropRect);
  if (btnRestoreOriginal) btnRestoreOriginal.addEventListener('click', restoreOriginalImage);

  cropRatioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      cropRatioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setCropRatio(btn.dataset.ratio);
    });
  });
}

function toggleCropMode() {
  if (!state.img) {
    showToast('Carga primero una foto de tu DNI para recortar.', 'info');
    return;
  }
  if (state.crop.active) {
    exitCropMode();
  } else {
    enterCropMode();
  }
}

function enterCropMode() {
  if (!state.img) return;
  state.crop.active = true;
  state.selectedBoxId = null;
  btnDeleteSelected.disabled = true;
  if (state.calibration.active) cancelCalibration();

  if (cropBar) cropBar.classList.remove('hidden');
  if (btnCropToggle) btnCropToggle.classList.add('active');
  resetCropRect();
  render();
}

function exitCropMode() {
  state.crop.active = false;
  state.crop.handle = null;
  if (cropBar) cropBar.classList.add('hidden');
  if (btnCropToggle) btnCropToggle.classList.remove('active');
  canvas.style.cursor = 'default';
  render();
}

function setCropRatio(ratio) {
  state.crop.ratio = ratio;
  resetCropRect();
  render();
}

function resetCropRect() {
  const w = canvas.width || 800;
  const h = canvas.height || 500;
  const margin = 0.06;

  if (state.crop.ratio === 'dni') {
    const canvasAspect = w / h;
    let rw, rh;
    if (canvasAspect >= DNI_ASPECT_RATIO) {
      rh = 1 - (margin * 2);
      const pixelH = rh * h;
      const pixelW = pixelH * DNI_ASPECT_RATIO;
      rw = pixelW / w;
    } else {
      rw = 1 - (margin * 2);
      const pixelW = rw * w;
      const pixelH = pixelW / DNI_ASPECT_RATIO;
      rh = pixelH / h;
    }
    state.crop.rect = {
      x: Math.max(0.01, (1 - rw) / 2),
      y: Math.max(0.01, (1 - rh) / 2),
      width: Math.min(0.98, rw),
      height: Math.min(0.98, rh)
    };
  } else if (state.crop.ratio === '1:1') {
    const minDim = Math.min(w, h);
    const rw = (minDim * 0.85) / w;
    const rh = (minDim * 0.85) / h;
    state.crop.rect = {
      x: (1 - rw) / 2,
      y: (1 - rh) / 2,
      width: rw,
      height: rh
    };
  } else {
    // Freeform
    state.crop.rect = { x: 0.06, y: 0.06, width: 0.88, height: 0.88 };
  }
}

function drawCropOverlay(width, height) {
  const r = state.crop.rect;
  const x = Math.round(r.x * width);
  const y = Math.round(r.y * height);
  const w = Math.round(r.width * width);
  const h = Math.round(r.height * height);

  ctx.save();

  // 1. Dark semi-transparent mask outside crop rect
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.fillRect(0, 0, width, Math.max(0, y));
  ctx.fillRect(0, y + h, width, Math.max(0, height - (y + h)));
  ctx.fillRect(0, y, Math.max(0, x), h);
  ctx.fillRect(x + w, y, Math.max(0, width - (x + w)), h);

  // 2. Crop border
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // 3. Rule-of-thirds grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w / 3, y);
  ctx.lineTo(x + w / 3, y + h);
  ctx.moveTo(x + (2 * w) / 3, y);
  ctx.lineTo(x + (2 * w) / 3, y + h);
  ctx.moveTo(x, y + h / 3);
  ctx.lineTo(x + w, y + h / 3);
  ctx.moveTo(x, y + (2 * h) / 3);
  ctx.lineTo(x + w, y + (2 * h) / 3);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Corner L-brackets
  const bLen = Math.min(22, Math.floor(Math.min(w, h) / 4));
  const bThick = 4;
  ctx.fillStyle = '#2563eb';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  const drawL = (px, py, dx, dy) => {
    ctx.beginPath();
    ctx.rect(px - (dx < 0 ? bLen : 0), py - (dy < 0 ? bThick : 0), bLen, bThick);
    ctx.rect(px - (dx < 0 ? bThick : 0), py - (dy < 0 ? bLen : 0), bThick, bLen);
    ctx.fill();
    ctx.stroke();
  };

  drawL(x, y, 1, 1);
  drawL(x + w, y, -1, 1);
  drawL(x + w, y + h, -1, -1);
  drawL(x, y + h, 1, -1);

  // 5. Edge handles
  const pillW = 22;
  const pillH = 6;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;

  // N
  ctx.fillRect(x + w / 2 - pillW / 2, y - pillH / 2, pillW, pillH);
  ctx.strokeRect(x + w / 2 - pillW / 2, y - pillH / 2, pillW, pillH);
  // S
  ctx.fillRect(x + w / 2 - pillW / 2, y + h - pillH / 2, pillW, pillH);
  ctx.strokeRect(x + w / 2 - pillW / 2, y + h - pillH / 2, pillW, pillH);
  // W
  ctx.fillRect(x - pillH / 2, y + h / 2 - pillW / 2, pillH, pillW);
  ctx.strokeRect(x - pillH / 2, y + h / 2 - pillW / 2, pillH, pillW);
  // E
  ctx.fillRect(x + w - pillH / 2, y + h / 2 - pillW / 2, pillH, pillW);
  ctx.strokeRect(x + w - pillH / 2, y + h / 2 - pillW / 2, pillH, pillW);

  // 6. Dimension tag badge
  const ratioLabel = state.crop.ratio === 'dni' 
    ? 'DNI Oficial (85.6 × 54 mm)' 
    : state.crop.ratio === '1:1' 
      ? 'Cuadrado 1:1' 
      : `${w} × ${h} px`;
  ctx.font = 'bold 11px -apple-system, sans-serif';
  const tm = ctx.measureText(ratioLabel);
  const tagW = tm.width + 16;
  const tagH = 22;
  const tagX = x + 8;
  const tagY = y + 8;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(ratioLabel, tagX + 8, tagY + tagH / 2);

  ctx.restore();
}

function applyCrop() {
  if (!state.crop.active || !state.img) return;

  const curW = canvas.width;
  const curH = canvas.height;
  const r = state.crop.rect;

  const cropPxX = Math.round(r.x * curW);
  const cropPxY = Math.round(r.y * curH);
  const cropPxW = Math.round(r.width * curW);
  const cropPxH = Math.round(r.height * curH);

  if (cropPxW < 20 || cropPxH < 20) {
    showToast('El área de recorte seleccionada es demasiado pequeña.', 'warning');
    return;
  }

  // Preserve pristine original image if not yet saved
  if (!state.originalImg) {
    state.originalImg = state.img;
    state.originalOrientation = state.imgOrientation;
  }

  // Draw base image at current rotation + fine tilt to an offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = curW;
  offscreen.height = curH;
  const offCtx = offscreen.getContext('2d');
  offCtx.save();
  offCtx.translate(curW / 2, curH / 2);
  const totalAngle = (state.imgOrientation + state.fineRotation) * (Math.PI / 180);
  offCtx.rotate(totalAngle);
  offCtx.drawImage(
    state.img,
    -state.img.width / 2,
    -state.img.height / 2,
    state.img.width,
    state.img.height
  );
  offCtx.restore();

  // Create canvas for cropped region
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropPxW;
  croppedCanvas.height = cropPxH;
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(
    offscreen,
    cropPxX, cropPxY, cropPxW, cropPxH,
    0, 0, cropPxW, cropPxH
  );

  const croppedDataUrl = croppedCanvas.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = () => {
    state.img = newImg;
    state.imgOrientation = 0;
    state.fineRotation = 0;
    if (straightenSlider) straightenSlider.value = 0;
    if (straightenVal) straightenVal.textContent = '0°';
    state.hasCropped = true;

    // Transform existing boxes if inside crop region
    const newBoxes = [];
    state.boxes.forEach(b => {
      const nx = (b.x - r.x) / r.width;
      const ny = (b.y - r.y) / r.height;
      const nw = b.width / r.width;
      const nh = b.height / r.height;
      if (nx + nw > 0.05 && nx < 0.95 && ny + nh > 0.05 && ny < 0.95) {
        newBoxes.push({
          ...b,
          x: Math.max(0, nx),
          y: Math.max(0, ny),
          width: Math.min(1 - Math.max(0, nx), nw),
          height: Math.min(1 - Math.max(0, ny), nh)
        });
      }
    });
    state.boxes = newBoxes;
    resetCalibration();
    exitCropMode();
    updateRestoreButton();
    render();
  };
  newImg.src = croppedDataUrl;
}

function restoreOriginalImage() {
  if (!state.originalImg) return;
  if (confirm('¿Restaurar la imagen original sin recortar?')) {
    state.img = state.originalImg;
    state.imgOrientation = state.originalOrientation || 0;
    state.fineRotation = 0;
    if (straightenSlider) straightenSlider.value = 0;
    if (straightenVal) straightenVal.textContent = '0°';
    state.originalImg = null;
    state.hasCropped = false;
    state.boxes = [];
    resetCalibration();
    updateRestoreButton();
    render();
  }
}

function updateRestoreButton() {
  if (btnRestoreOriginal) {
    if (state.hasCropped) {
      btnRestoreOriginal.classList.remove('hidden');
    } else {
      btnRestoreOriginal.classList.add('hidden');
    }
  }
}

// --- INTERACTIVE ANIMATION CONTROLLER ---
const animationState = {
  currentStep: 0,
  isPlaying: false,
  timer: null,
  speed: 1,
  steps: [
    {
      title: "1. El Peligro: ¿Por qué NUNCA enviar tu DNI sin proteger?",
      text: "Al alquilar un piso, reservar hotel o hacer trámites online, te piden copia del DNI. Si cae en manos de ciberdelincuentes, usan el <strong>Nº de Soporte, Firma y CAN</strong> para pedir créditos rápidos o suplantar tu identidad.",
      action: (card) => {
        card.classList.remove('grayscale-mode', 'rotated');
        card.querySelector('#anim-crop-frame').classList.add('hidden');
        card.querySelector('#anim-watermark-layer').classList.add('hidden');
        card.querySelector('#anim-success-shield').classList.add('hidden');
        card.querySelectorAll('.anim-target-zone').forEach(z => {
          z.classList.remove('censored');
          z.classList.add('danger-pulse');
        });
      }
    },
    {
      title: "2. 100% Privado: Nada sale de tu dispositivo",
      text: "ProtegeDNI procesa tu foto <strong>en tu propio dispositivo</strong> mediante HTML5 Canvas. Ningún dato viaja a la nube ni a servidores. Además, se eliminan los datos de ubicación GPS y cámara automáticamente.",
      action: (card) => {
        card.classList.remove('grayscale-mode', 'rotated');
        card.querySelector('#anim-crop-frame').classList.add('hidden');
        card.querySelector('#anim-watermark-layer').classList.add('hidden');
        card.querySelector('#anim-success-shield').classList.add('hidden');
        card.querySelectorAll('.anim-target-zone').forEach(z => {
          z.classList.remove('danger-pulse', 'censored');
        });
      }
    },
    {
      title: "3. Recortar y Rotar: Encuadre perfecto",
      text: "Las fotos hechas con el móvil suelen tener bordes de la mesa y estar torcidas. Usa las herramientas de <strong>Giro 90°</strong>, <strong>Enderezar</strong> y el marco de <strong>Recorte con proporción oficial del DNI</strong>.",
      action: (card) => {
        card.classList.remove('grayscale-mode');
        card.classList.add('rotated');
        card.querySelector('#anim-crop-frame').classList.remove('hidden');
        card.querySelector('#anim-watermark-layer').classList.add('hidden');
        card.querySelector('#anim-success-shield').classList.add('hidden');
        card.querySelectorAll('.anim-target-zone').forEach(z => {
          z.classList.remove('danger-pulse', 'censored');
        });
      }
    },
    {
      title: "4. Protección AEPD: Ocultación de datos críticos",
      text: "Aplica en 1 solo clic la recomendación de la <strong>AEPD y Policía Nacional</strong>: ocultación de la Firma manuscrita, Clave CAN y Nº de Soporte / IDESP (o líneas de lectura <<< en el reverso).",
      action: (card) => {
        card.classList.remove('grayscale-mode', 'rotated');
        card.querySelector('#anim-crop-frame').classList.add('hidden');
        card.querySelector('#anim-watermark-layer').classList.add('hidden');
        card.querySelector('#anim-success-shield').classList.add('hidden');
        card.querySelectorAll('.anim-target-zone').forEach(z => {
          z.classList.remove('danger-pulse');
          z.classList.add('censored');
        });
      }
    },
    {
      title: "5. Convertir a Blanco y Negro: Invalida copias fraudulentas",
      text: "Convierte el documento a escala de grises recomendada por la Policía. Esto <strong>invalida la copia como documento original a color</strong> para verificación de identidad bancaria y financiera (KYC) fraudulenta.",
      action: (card) => {
        card.classList.add('grayscale-mode');
        card.classList.remove('rotated');
        card.querySelector('#anim-crop-frame').classList.add('hidden');
        card.querySelector('#anim-watermark-layer').classList.add('hidden');
        card.querySelector('#anim-success-shield').classList.add('hidden');
        card.querySelectorAll('.anim-target-zone').forEach(z => {
          z.classList.remove('danger-pulse');
          z.classList.add('censored');
        });
      }
    },
    {
      title: "6. Marca de Agua: Finalidad única y fecha",
      text: "Estampa un texto diagonal cruzado con el destinatario exclusivo (ej: <code>USO EXCLUSIVO ALQUILER PISO</code>) y la fecha de hoy. Si alguien filtra la foto, queda legalmente inutilizada para cualquier otro fin.",
      action: (card) => {
        card.classList.add('grayscale-mode');
        card.classList.remove('rotated');
        card.querySelector('#anim-crop-frame').classList.add('hidden');
        card.querySelector('#anim-watermark-layer').classList.remove('hidden');
        card.querySelector('#anim-success-shield').classList.add('hidden');
        card.querySelectorAll('.anim-target-zone').forEach(z => {
          z.classList.remove('danger-pulse');
          z.classList.add('censored');
        });
      }
    },
    {
      title: "7. Exportación Segura: Descarga o copia directa",
      text: "Descarga en JPG/PNG o copia directamente al portapapeles. ¡Tu DNI ya está <strong>100% protegido</strong> y listo para enviar por WhatsApp o correo con total tranquilidad!",
      action: (card) => {
        card.classList.add('grayscale-mode');
        card.classList.remove('rotated');
        card.querySelector('#anim-crop-frame').classList.add('hidden');
        card.querySelector('#anim-watermark-layer').classList.remove('hidden');
        card.querySelector('#anim-success-shield').classList.remove('hidden');
      }
    }
  ]
};

function setupAnimationModal() {
  if (btnOpenAnimation) btnOpenAnimation.addEventListener('click', openAnimationModal);
  if (btnEmptyAnimation) btnEmptyAnimation.addEventListener('click', openAnimationModal);
  if (btnCloseAnimation) btnCloseAnimation.addEventListener('click', closeAnimationModal);
  if (btnAnimCloseBottom) btnAnimCloseBottom.addEventListener('click', closeAnimationModal);
  if (animationModal) {
    animationModal.addEventListener('click', (e) => {
      if (e.target === animationModal) closeAnimationModal();
    });
  }

  if (btnAnimPlay) btnAnimPlay.addEventListener('click', toggleAnimPlay);
  if (btnAnimPrev) btnAnimPrev.addEventListener('click', prevAnimStep);
  if (btnAnimNext) btnAnimNext.addEventListener('click', nextAnimStep);
  if (btnAnimRestart) btnAnimRestart.addEventListener('click', restartAnim);
  if (btnAnimSpeed) btnAnimSpeed.addEventListener('click', cycleAnimSpeed);

  animStepChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const step = parseInt(chip.dataset.step, 10);
      goToAnimStep(step);
    });
  });

  if (btnAnimTryDemo) {
    btnAnimTryDemo.addEventListener('click', () => {
      closeAnimationModal();
      loadDemoSide('Spanish_ID_card_(front_side).webp', 'front');
    });
  }
}

function openAnimationModal() {
  if (!animationModal) return;
  animationModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const modalBody = animationModal.querySelector('.modal-body');
  if (modalBody) modalBody.scrollTop = 0;
  goToAnimStep(0);
  startAnimAutoPlay();
}

function closeAnimationModal() {
  if (!animationModal) return;
  animationModal.classList.add('hidden');
  document.body.style.overflow = '';
  stopAnimAutoPlay();
}

function toggleAnimPlay() {
  if (animationState.isPlaying) {
    stopAnimAutoPlay();
  } else {
    startAnimAutoPlay();
  }
}

function startAnimAutoPlay() {
  animationState.isPlaying = true;
  if (animPlayIcon) animPlayIcon.textContent = '⏸';
  if (animPlayText) animPlayText.textContent = 'Pausar';
  scheduleNextAnimStep();
}

function stopAnimAutoPlay() {
  animationState.isPlaying = false;
  if (animPlayIcon) animPlayIcon.textContent = '▶';
  if (animPlayText) animPlayText.textContent = 'Reproducir';
  if (animationState.timer) {
    clearTimeout(animationState.timer);
    animationState.timer = null;
  }
}

function scheduleNextAnimStep() {
  if (animationState.timer) clearTimeout(animationState.timer);
  const duration = Math.round(3800 / animationState.speed);
  animationState.timer = setTimeout(() => {
    if (!animationState.isPlaying) return;
    const next = (animationState.currentStep + 1) % animationState.steps.length;
    goToAnimStep(next);
    scheduleNextAnimStep();
  }, duration);
}

function goToAnimStep(index) {
  animationState.currentStep = index;
  const step = animationState.steps[index];
  if (!step) return;

  animStepChips.forEach((chip, i) => {
    if (i === index) {
      chip.classList.add('active');
      chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      chip.classList.remove('active');
    }
  });

  if (animStepNum) animStepNum.textContent = `Paso ${index + 1} de ${animationState.steps.length}`;
  if (animStepHeading) animStepHeading.innerHTML = step.title;
  if (animStepText) animStepText.innerHTML = step.text;

  if (animProgressBar) {
    const pct = Math.round(((index + 1) / animationState.steps.length) * 100);
    animProgressBar.style.width = pct + '%';
  }

  if (animDniCard) {
    step.action(animDniCard);
  }
}

function nextAnimStep() {
  stopAnimAutoPlay();
  const next = (animationState.currentStep + 1) % animationState.steps.length;
  goToAnimStep(next);
}

function prevAnimStep() {
  stopAnimAutoPlay();
  const prev = (animationState.currentStep - 1 + animationState.steps.length) % animationState.steps.length;
  goToAnimStep(prev);
}

function restartAnim() {
  goToAnimStep(0);
  startAnimAutoPlay();
}

function cycleAnimSpeed() {
  if (animationState.speed === 1) {
    animationState.speed = 1.5;
  } else if (animationState.speed === 1.5) {
    animationState.speed = 2;
  } else {
    animationState.speed = 1;
  }
  if (btnAnimSpeed) btnAnimSpeed.textContent = animationState.speed + 'x';
  if (animationState.isPlaying) {
    scheduleNextAnimStep();
  }
}

// Start application
window.addEventListener('DOMContentLoaded', init);
