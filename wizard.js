/**
 * wizard.js - State Machine and Navigation for ProtegeDNI Wizard
 */
window.state = {
  wizardStep: 'step-1-1',
  currentSide: 'front',
  sides: {
    front: { img: null, imgOrientation: 0, fineRotation: 0, calibration: { topLeft: null, bottomRight: null }, boxes: [], skipped: false },
    back: { img: null, imgOrientation: 0, fineRotation: 0, calibration: { topLeft: null, bottomRight: null }, boxes: [], skipped: false }
  },
  calibration: { active: false, step: 0 },
  selectedBoxId: null,
  interaction: { mode: 'idle', startX: 0, startY: 0, handle: null, targetBox: null, dragOffset: { x: 0, y: 0 } },
  exportSettings: {
    watermarkText: 'COPIA VÁLIDA SOLO PARA VERIFICACIÓN',
    watermarkDate: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()),
    includeDate: true,
    mergeLayout: 'vertical',
    format: 'image/jpeg'
  }
};

const WIZARD_STEPS = ['step-1-1', 'step-1-2', 'step-1-3', 'step-2-1', 'step-2-2', 'step-2-3', 'step-final'];
const WIZARD_STEP_META = {
  'step-1-1': { num: '1.1', title: 'Añadir Anverso', side: 'front', progress: 14.28 },
  'step-1-2': { num: '1.2', title: 'Ajustar y Esquinas Anverso', side: 'front', progress: 28.57 },
  'step-1-3': { num: '1.3', title: 'Anonimizar Anverso', side: 'front', progress: 42.85 },
  'step-2-1': { num: '2.1', title: 'Añadir Reverso', side: 'back', progress: 57.14 },
  'step-2-2': { num: '2.2', title: 'Ajustar y Esquinas Reverso', side: 'back', progress: 71.42 },
  'step-2-3': { num: '2.3', title: 'Anonimizar Reverso', side: 'back', progress: 85.71 },
  'step-final': { num: 'Final', title: 'Exportar DNI Protegido', side: 'both', progress: 100 }
};

function goToStep(targetStepId) {
  if (!WIZARD_STEPS.includes(targetStepId)) return;

  if (['step-1-2', 'step-1-3', 'step-2-1'].includes(targetStepId) && !window.state.sides.front.img) {
    if (window.showToast) window.showToast('Sube o selecciona primero el anverso.', 'warning');
    return;
  }
  if (['step-2-2', 'step-2-3'].includes(targetStepId) && (!window.state.sides.back.img || window.state.sides.back.skipped)) {
    if (window.showToast) window.showToast('Sube el reverso o pulsa omitir.', 'warning');
    return;
  }
  if (targetStepId === 'step-final' && !window.state.sides.front.img) {
    if (window.showToast) window.showToast('Añade al menos el anverso para exportar.', 'warning');
    goToStep('step-1-1');
    return;
  }

  window.state.wizardStep = targetStepId;
  const meta = WIZARD_STEP_META[targetStepId];
  window.state.currentSide = meta.side;

  document.querySelectorAll('.wizard-step').forEach(el => el.classList.toggle('active', el.id === targetStepId));

  const progressFill = document.getElementById('wizard-progress-fill');
  const badge = document.getElementById('wizard-step-badge');
  const name = document.getElementById('wizard-step-name');
  const fraction = document.getElementById('wizard-step-fraction');

  if (progressFill) progressFill.style.width = `${meta.progress}%`;
  if (badge) badge.textContent = `Paso ${meta.num}`;
  if (name) name.textContent = meta.title;
  if (fraction) fraction.textContent = `${WIZARD_STEPS.indexOf(targetStepId) + 1} de 7`;

  document.querySelectorAll('#wizard-stepper-dots .step-dot').forEach(dot => {
    const target = dot.dataset.stepTarget;
    const targetIdx = WIZARD_STEPS.indexOf(target);
    const currIdx = WIZARD_STEPS.indexOf(targetStepId);
    dot.classList.toggle('active', target === targetStepId);
    dot.classList.toggle('completed', targetIdx < currIdx);
    dot.setAttribute('aria-selected', target === targetStepId ? 'true' : 'false');
  });

  if (window.CanvasEngine) {
    window.CanvasEngine.mountCanvas(targetStepId);
    if (targetStepId === 'step-final') {
      if (window.ExportEngine) window.ExportEngine.renderExportCanvas();
    } else {
      window.CanvasEngine.renderStepCanvas(targetStepId);
      window.CanvasEngine.syncPresetChips();
    }
  }

  updateNavButtons(targetStepId);
  window.scrollTo(0, 0);
}

function nextStep() {
  const curr = window.state.wizardStep;
  const currIdx = WIZARD_STEPS.indexOf(curr);
  if (curr === 'step-1-1') {
    if (!window.state.sides.front.img) {
      if (window.showToast) window.showToast('Sube o selecciona una foto del anverso.', 'warning');
      return;
    }
    goToStep('step-1-2');
  } else if (curr === 'step-2-1') {
    if (!window.state.sides.back.img) {
      if (window.showToast) window.showToast('Sube el reverso o pulsa "Omitir reverso".', 'info');
      return;
    }
    window.state.sides.back.skipped = false;
    goToStep('step-2-2');
  } else if (currIdx < WIZARD_STEPS.length - 1) {
    goToStep(WIZARD_STEPS[currIdx + 1]);
  }
}

function prevStep() {
  const curr = window.state.wizardStep;
  const currIdx = WIZARD_STEPS.indexOf(curr);
  if (currIdx <= 0) return;

  if (curr === 'step-final' && window.state.sides.back.skipped) {
    goToStep('step-2-1');
    return;
  }
  goToStep(WIZARD_STEPS[currIdx - 1]);
}

function skipBackSide() {
  window.state.sides.back.skipped = true;
  window.state.sides.back.img = null;
  window.state.sides.back.boxes = [];
  if (window.showToast) window.showToast('Reverso omitido. Documento con anverso.', 'info');
  goToStep('step-final');
}

function updateNavButtons(stepId) {
  const prevBtn = document.getElementById('btn-wizard-prev');
  const nextBtn = document.getElementById('btn-wizard-next');
  const prevText = document.getElementById('btn-prev-text');
  const nextText = document.getElementById('btn-next-text');

  if (prevBtn) {
    prevBtn.disabled = stepId === 'step-1-1';
    if (prevText) {
      if (stepId === 'step-1-2') prevText.textContent = 'Atrás: Cambiar foto';
      else if (stepId === 'step-2-1') prevText.textContent = 'Atrás: Anverso';
      else if (stepId === 'step-final' && window.state.sides.back.skipped) prevText.textContent = 'Atrás: Reverso';
      else prevText.textContent = 'Atrás';
    }
  }

  if (nextBtn) {
    if (stepId === 'step-final') {
      nextBtn.classList.add('hidden');
    } else {
      nextBtn.classList.remove('hidden');
      if (stepId === 'step-1-1') {
        nextBtn.disabled = !window.state.sides.front.img;
        if (nextText) nextText.textContent = 'Siguiente: Ajustar foto';
      } else if (stepId === 'step-1-2') {
        nextBtn.disabled = false;
        if (nextText) nextText.textContent = 'Siguiente: Tapar datos';
      } else if (stepId === 'step-1-3') {
        nextBtn.disabled = false;
        if (nextText) nextText.textContent = 'Siguiente: Reverso';
      } else if (stepId === 'step-2-1') {
        nextBtn.disabled = !window.state.sides.back.img;
        if (nextText) nextText.textContent = 'Siguiente: Ajustar reverso';
      } else if (stepId === 'step-2-2') {
        nextBtn.disabled = false;
        if (nextText) nextText.textContent = 'Siguiente: Tapar reverso';
      } else if (stepId === 'step-2-3') {
        nextBtn.disabled = false;
        if (nextText) nextText.textContent = 'Siguiente: Finalizar';
      }
    }
  }
}

function restartWizard() {
  window.state.sides.front = { img: null, imgOrientation: 0, fineRotation: 0, calibration: { topLeft: null, bottomRight: null }, boxes: [], skipped: false };
  window.state.sides.back = { img: null, imgOrientation: 0, fineRotation: 0, calibration: { topLeft: null, bottomRight: null }, boxes: [], skipped: false };
  window.state.calibration = { active: false, step: 0 };
  window.state.selectedBoxId = null;

  ['front', 'back'].forEach(side => {
    const preview = document.getElementById(`preview-${side}-loaded`);
    if (preview) preview.classList.add('hidden');
    const input = document.getElementById(`file-input-${side}`);
    if (input) input.value = '';
  });

  goToStep('step-1-1');
  if (window.showToast) window.showToast('Asistente reiniciado.', 'info');
}

window.Wizard = { goToStep, nextStep, prevStep, skipBackSide, updateNavButtons, restartWizard };
