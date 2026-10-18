/**
 * app.js - Bootstrap Initialization and DOM Event Wiring for ProtegeDNI
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}
window.showToast = showToast;
document.addEventListener('DOMContentLoaded', () => {
  const on = (id, evt, fn) => document.getElementById(id)?.addEventListener(evt, fn);

  // Navigation
  on('btn-wizard-prev', 'click', () => window.Wizard.prevStep());
  on('btn-wizard-next', 'click', () => window.Wizard.nextStep());
  document.querySelectorAll('#wizard-stepper-dots .step-dot').forEach(btn => btn.addEventListener('click', () => window.Wizard.goToStep(btn.dataset.stepTarget)));

  // Upload & Demo buttons
  ['front', 'back'].forEach(side => {
    on(`file-input-${side}`, 'change', e => e.target.files?.[0] && window.CanvasEngine.loadCardImage(e.target.files[0], side));
    on(`btn-demo-${side}`, 'click', () => window.CanvasEngine.loadDemoCard(side));
    const drop = document.getElementById(`drop-zone-${side}`);
    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop?.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('dragover');
      if (e.dataTransfer?.files?.[0]) window.CanvasEngine.loadCardImage(e.dataTransfer.files[0], side);
    });
  });
  on('btn-skip-back', 'click', () => window.Wizard.skipBackSide());

  // Rotation & Straighten
  on('btn-rotate-left', 'click', () => window.CanvasEngine.rotateSide('front', -90));
  on('btn-rotate-right', 'click', () => window.CanvasEngine.rotateSide('front', 90));
  on('straighten-slider', 'input', e => window.CanvasEngine.setFineRotation('front', e.target.value));
  on('btn-reset-straighten', 'click', () => { const s = document.getElementById('straighten-slider'); if (s) s.value = 0; window.CanvasEngine.setFineRotation('front', 0); });

  on('btn-rotate-left-back', 'click', () => window.CanvasEngine.rotateSide('back', -90));
  on('btn-rotate-right-back', 'click', () => window.CanvasEngine.rotateSide('back', 90));
  on('straighten-slider-back', 'input', e => window.CanvasEngine.setFineRotation('back', e.target.value));
  on('btn-reset-straighten-back', 'click', () => { const s = document.getElementById('straighten-slider-back'); if (s) s.value = 0; window.CanvasEngine.setFineRotation('back', 0); });

  // Calibration
  on('btn-start-calibration', 'click', () => window.CanvasEngine.startCalibration());
  on('btn-start-calibration-back', 'click', () => window.CanvasEngine.startCalibration());
  on('btn-cancel-calib', 'click', () => window.CanvasEngine.cancelCalibration());
  on('btn-reset-calib', 'click', () => window.CanvasEngine.resetCalibration(window.state.currentSide));

  // Presets & Redactions
  document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => window.CanvasEngine.togglePreset(btn.dataset.preset)));
  on('btn-recommend-aepd', 'click', () => window.CanvasEngine.applyAEPD());
  on('btn-delete-selected', 'click', () => window.CanvasEngine.deleteSelectedBox());
  on('btn-delete-selected-back', 'click', () => window.CanvasEngine.deleteSelectedBox());
  on('btn-clear-boxes', 'click', () => window.CanvasEngine.clearBoxes());
  on('btn-clear-boxes-back', 'click', () => window.CanvasEngine.clearBoxes());

  // Watermark text, tags, date & format
  const wmInput = document.getElementById('wm-text');
  wmInput?.addEventListener('input', e => { window.state.exportSettings.watermarkText = e.target.value; window.ExportEngine.renderExportCanvas(); });
  document.querySelectorAll('.quick-tags-grid .tag-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.quick-tags-grid .tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); if (wmInput) wmInput.value = btn.dataset.text || btn.textContent;
    window.state.exportSettings.watermarkText = wmInput ? wmInput.value : ''; window.ExportEngine.renderExportCanvas();
  }));
  const datePrev = document.getElementById('current-date-preview');
  if (datePrev) datePrev.textContent = window.state.exportSettings.watermarkDate;
  on('wm-include-date', 'change', e => { window.state.exportSettings.includeDate = e.target.checked; window.ExportEngine.renderExportCanvas(); });
  on('export-format', 'change', e => { window.state.exportSettings.format = e.target.value; });
  const setMergeLayout = (btn) => {
    if (window.state.exportSettings.mergeLayout === btn.dataset.mergeLayout && btn.classList.contains('active')) return;
    document.querySelectorAll('#merge-layout-segments .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); window.state.exportSettings.mergeLayout = btn.dataset.mergeLayout; window.ExportEngine.renderExportCanvas();
  };
  document.querySelectorAll('#merge-layout-segments .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => setMergeLayout(btn));
    btn.addEventListener('pointerup', () => setMergeLayout(btn));
  });

  // Export & restart
  on('btn-download', 'click', () => window.ExportEngine.downloadImage());
  on('btn-copy-clipboard', 'click', () => window.ExportEngine.copyOrShareForWhatsApp());
  on('btn-restart-wizard', 'click', () => window.Wizard.restartWizard());

  // Modals
  const guide = document.getElementById('guide-modal');
  on('btn-open-guide', 'click', () => guide?.classList.remove('hidden'));
  on('btn-close-guide', 'click', () => guide?.classList.add('hidden'));
  on('btn-modal-apply-aepd', 'click', () => { guide?.classList.add('hidden'); window.CanvasEngine.applyAEPD(); });
  document.querySelectorAll('[data-info]').forEach(btn => btn.addEventListener('click', () => {
    guide?.classList.remove('hidden');
    const target = document.getElementById(`guide-item-${btn.dataset.info}`);
    if (target) { target.scrollIntoView({ behavior: 'smooth' }); target.classList.add('highlight-pulse'); setTimeout(() => target.classList.remove('highlight-pulse'), 1500); }
  }));
  const anim = document.getElementById('animation-modal');
  on('btn-open-animation', 'click', () => anim?.classList.remove('hidden'));
  ['btn-close-animation', 'btn-anim-close-bottom'].forEach(id => on(id, 'click', () => anim?.classList.add('hidden')));

  window.CanvasEngine.initPointerEvents();
  window.Wizard.goToStep('step-1-1');
});
