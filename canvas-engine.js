/**
 * canvas-engine.js - Canvas Mounting, Image Loading, Rotation, Calibration, Redactions
 */
const PRESETS_FRONT = {
  firma: { x: 0.43, y: 0.74, width: 0.31, height: 0.16, label: 'Firma manuscrita' }, can: { x: 0.75, y: 0.79, width: 0.22, height: 0.13, label: 'Clave CAN' },
  soporte: { x: 0.39, y: 0.65, width: 0.25, height: 0.10, label: 'Nº Soporte / IDESP' }, validez: { x: 0.57, y: 0.57, width: 0.19, height: 0.08, label: 'Validez' },
  nacimiento: { x: 0.77, y: 0.48, width: 0.19, height: 0.08, label: 'Fecha Nac.' }, foto_extra: { x: 0.81, y: 0.58, width: 0.15, height: 0.20, label: 'Foto secundaria' }
};
const PRESETS_BACK = {
  mrz: { x: 0.04, y: 0.64, width: 0.92, height: 0.31, label: 'Líneas lectura <<<' }, domicilio: { x: 0.28, y: 0.06, width: 0.38, height: 0.23, label: 'Dirección (Domicilio)' },
  padres: { x: 0.28, y: 0.48, width: 0.34, height: 0.12, label: 'Nombre Padres' }, lugar_nac: { x: 0.28, y: 0.31, width: 0.30, height: 0.15, label: 'Lugar Nac.' }
};

function mountCanvas(stepId) {
  const host = document.querySelector(`#${stepId} [data-canvas-stage]`), wrapper = document.getElementById('canvas-wrapper');
  if (host && wrapper && wrapper.parentElement !== host) { host.appendChild(wrapper); wrapper.classList.remove('hidden'); }
  else if (!host && wrapper) wrapper.classList.add('hidden');
}

function finishImageLoad(img, side, src) {
  const s = window.state.sides[side];
  s.img = img; s.originalImg = img; s.skipped = false;
  s.imgOrientation = 0; s.fineRotation = 0;
  s.calibration = { topLeft: null, bottomRight: null };
  document.getElementById(`btn-undo-crop-${side}`)?.classList.add('hidden');
  const thumb = document.getElementById(`thumb-${side}-loaded`), prev = document.getElementById(`preview-${side}-loaded`);
  if (thumb) thumb.src = src; if (prev) prev.classList.remove('hidden');
  if (window.showToast) window.showToast(`✓ ${side === 'front' ? 'Anverso' : 'Reverso'} listo`, 'success');
  window.Wizard.updateNavButtons(window.state.wizardStep);
  window.Wizard.goToStep(side === 'front' ? 'step-1-2' : 'step-2-2');
}

function loadCardImage(file, side) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { const img = new Image(); img.onload = () => finishImageLoad(img, side, e.target.result); img.src = e.target.result; };
  reader.readAsDataURL(file);
}

function loadDemoCard(side) {
  const src = side === 'front' ? 'Spanish_ID_card_(front_side).webp' : 'back.jpg';
  const img = new Image();
  img.onload = () => finishImageLoad(img, side, src);
  img.src = src;
}

function rotateSide(side, degDelta) {
  const s = window.state.sides[side];
  s.imgOrientation = (s.imgOrientation + degDelta + 360) % 360;
  renderStepCanvas(window.state.wizardStep);
}

function setFineRotation(side, deg) {
  const s = window.state.sides[side]; s.fineRotation = parseFloat(deg) || 0;
  const badge = document.getElementById(side === 'front' ? 'straighten-val' : 'straighten-val-back');
  if (badge) badge.textContent = `${s.fineRotation > 0 ? '+' : ''}${s.fineRotation}°`;
  renderStepCanvas(window.state.wizardStep);
}

function startCalibration() {
  window.state.calibration = { active: true, step: 1 };
  document.getElementById('calibration-bar')?.classList.remove('hidden');
  const ind = document.getElementById('calib-indicator'), inst = document.getElementById('calib-instruction');
  if (ind) ind.textContent = 'Paso 1 de 2'; if (inst) inst.innerHTML = 'Toca la <strong>esquina superior izquierda</strong>';
  renderStepCanvas(window.state.wizardStep);
}

function cancelCalibration() {
  window.state.calibration = { active: false, step: 0 };
  document.getElementById('calibration-bar')?.classList.add('hidden');
  renderStepCanvas(window.state.wizardStep);
}

function resetCalibration(side) {
  window.state.sides[side].calibration = { topLeft: null, bottomRight: null };
  cancelCalibration();
  if (window.showToast) window.showToast('Esquinas restablecidas.', 'info');
}

function applyCornerCropAndRotate(side) {
  const s = window.state.sides[side];
  if (!s.img || !s.calibration.topLeft || !s.calibration.bottomRight) return;
  const canvas = document.getElementById('dni-canvas');
  if (!canvas) return;

  // Render clean oriented image without pins
  const prevActive = window.state.calibration.active;
  const savedCal = { ...s.calibration };
  s.calibration = { topLeft: null, bottomRight: null };
  window.state.calibration.active = false;
  renderStepCanvas(window.state.wizardStep);

  const x1 = Math.max(0, Math.round(Math.min(savedCal.topLeft.x, savedCal.bottomRight.x) * canvas.width));
  const y1 = Math.max(0, Math.round(Math.min(savedCal.topLeft.y, savedCal.bottomRight.y) * canvas.height));
  const x2 = Math.min(canvas.width, Math.round(Math.max(savedCal.topLeft.x, savedCal.bottomRight.x) * canvas.width));
  const y2 = Math.min(canvas.height, Math.round(Math.max(savedCal.topLeft.y, savedCal.bottomRight.y) * canvas.height));
  const cw = Math.max(20, x2 - x1), ch = Math.max(20, y2 - y1);

  // If marked card is taller than wide (portrait), rotate 90° automatically so DNI is landscape
  const needsAutoRotate = ch > cw * 1.08;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = needsAutoRotate ? ch : cw;
  outCanvas.height = needsAutoRotate ? cw : ch;
  const octx = outCanvas.getContext('2d');

  if (needsAutoRotate) {
    octx.translate(outCanvas.width / 2, outCanvas.height / 2);
    octx.rotate(-Math.PI / 2);
    octx.drawImage(canvas, x1, y1, cw, ch, -cw / 2, -ch / 2, cw, ch);
  } else {
    octx.drawImage(canvas, x1, y1, cw, ch, 0, 0, cw, ch);
  }

  const croppedImg = new Image();
  croppedImg.onload = () => {
    if (!s.originalImg) s.originalImg = s.img;
    s.img = croppedImg;
    s.imgOrientation = 0;
    s.fineRotation = 0;
    s.calibration = { topLeft: null, bottomRight: null };
    const slider = document.getElementById(side === 'front' ? 'straighten-slider' : 'straighten-slider-back');
    if (slider) slider.value = 0;
    const badge = document.getElementById(side === 'front' ? 'straighten-val' : 'straighten-val-back');
    if (badge) badge.textContent = '0°';
    document.getElementById(`btn-undo-crop-${side}`)?.classList.remove('hidden');

    // Remap any existing preset boxes to full card bounds
    s.boxes.forEach(b => {
      if (b.presetKey) {
        const def = (side === 'front' ? PRESETS_FRONT : PRESETS_BACK)[b.presetKey];
        if (def) { b.x = def.x; b.y = def.y; b.width = def.width; b.height = def.height; }
      }
    });

    renderStepCanvas(window.state.wizardStep);
    if (window.showToast) {
      window.showToast(needsAutoRotate ? '✂️ DNI recortado y orientado en horizontal' : '✂️ DNI recortado y encuadrado con éxito', 'success');
    }
  };
  croppedImg.src = outCanvas.toDataURL('image/png');
  window.state.calibration.active = prevActive;
}

function undoCornerCrop(side) {
  const s = window.state.sides[side];
  if (!s || !s.originalImg) return;
  s.img = s.originalImg;
  s.imgOrientation = 0;
  s.fineRotation = 0;
  s.calibration = { topLeft: null, bottomRight: null };
  document.getElementById(`btn-undo-crop-${side}`)?.classList.add('hidden');
  renderStepCanvas(window.state.wizardStep);
  if (window.showToast) window.showToast('↺ Foto original restaurada', 'info');
}

function togglePreset(key) {
  const side = window.state.currentSide, s = window.state.sides[side];
  const def = (side === 'front' ? PRESETS_FRONT : PRESETS_BACK)[key];
  if (!def) return;
  const idx = s.boxes.findIndex(b => b.presetKey === key);
  if (idx !== -1) { s.boxes.splice(idx, 1); }
  else {
    let { x, y, width, height } = def;
    if (s.calibration.topLeft && s.calibration.bottomRight) {
      const spanX = s.calibration.bottomRight.x - s.calibration.topLeft.x, spanY = s.calibration.bottomRight.y - s.calibration.topLeft.y;
      x = s.calibration.topLeft.x + def.x * spanX; y = s.calibration.topLeft.y + def.y * spanY;
      width = def.width * spanX; height = def.height * spanY;
    }
    s.boxes.push({ id: `box_${Date.now()}_${key}`, presetKey: key, x, y, width, height, label: def.label, style: 'pixelate' });
  }
  syncPresetChips();
  renderStepCanvas(window.state.wizardStep);
}

function applyAEPD() {
  const side = window.state.currentSide, s = window.state.sides[side];
  const keys = side === 'front' ? ['firma', 'can', 'soporte'] : ['mrz', 'domicilio'];
  const allActive = keys.every(k => s.boxes.some(b => b.presetKey === k));
  keys.forEach(k => {
    const has = s.boxes.some(b => b.presetKey === k);
    if ((allActive && has) || (!allActive && !has)) togglePreset(k);
  });
  if (window.showToast) window.showToast(allActive ? 'Recomendaciones AEPD desactivadas' : '✓ Protección AEPD aplicada', 'success');
}

function syncPresetChips() {
  const side = window.state.currentSide, s = window.state.sides[side];
  if (!s) return;
  const container = document.getElementById(side === 'front' ? 'presets-front' : 'presets-back');
  if (container) {
    container.querySelectorAll('.chip-toggle-btn').forEach(btn => {
      const isActive = s.boxes.some(b => b.presetKey === btn.dataset.preset);
      btn.classList.toggle('active', isActive); btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      const icon = btn.querySelector('.chip-status-icon'); if (icon) icon.textContent = isActive ? '✓' : '+';
    });
  }
  const countEl = document.getElementById(side === 'front' ? 'box-count-front' : 'box-count-back');
  if (countEl) countEl.textContent = `${s.boxes.length} tapadas`;
  const delBtn = document.getElementById(side === 'front' ? 'btn-delete-selected' : 'btn-delete-selected-back');
  if (delBtn) delBtn.disabled = !window.state.selectedBoxId;
}

function deleteSelectedBox() {
  const s = window.state.sides[window.state.currentSide];
  if (!window.state.selectedBoxId || !s) return;
  s.boxes = s.boxes.filter(b => b.id !== window.state.selectedBoxId); window.state.selectedBoxId = null;
  syncPresetChips(); renderStepCanvas(window.state.wizardStep);
}

function clearBoxes() {
  const s = window.state.sides[window.state.currentSide];
  if (s) s.boxes = []; window.state.selectedBoxId = null;
  syncPresetChips(); renderStepCanvas(window.state.wizardStep);
}

function renderStepCanvas(stepId) {
  const canvas = document.getElementById('dni-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const side = (stepId.includes('2-') ? 'back' : 'front'), s = window.state.sides[side];

  if (!s.img) {
    canvas.width = 600; canvas.height = 380;
    ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const isRot = (s.imgOrientation % 180 !== 0);
  canvas.width = isRot ? s.img.naturalHeight : s.img.naturalWidth;
  canvas.height = isRot ? s.img.naturalWidth : s.img.naturalHeight;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((s.imgOrientation + s.fineRotation) * Math.PI / 180);
  ctx.drawImage(s.img, -(isRot ? canvas.height : canvas.width) / 2, -(isRot ? canvas.width : canvas.height) / 2, isRot ? canvas.height : canvas.width, isRot ? canvas.width : canvas.height);
  ctx.restore();

  if (['step-1-3', 'step-2-3'].includes(stepId) && s.boxes.length > 0) {
    const blockSize = Math.max(6, Math.round(18 * (canvas.width / 900)));
    s.boxes.forEach(b => {
      const bx = Math.max(0, Math.round(b.x * canvas.width)), by = Math.max(0, Math.round(b.y * canvas.height));
      const bw = Math.min(canvas.width - bx, Math.round(b.width * canvas.width)), bh = Math.min(canvas.height - by, Math.round(b.height * canvas.height));
      if (bw <= 0 || bh <= 0) return;

      const off = document.createElement('canvas'), sw = Math.max(1, Math.floor(bw / blockSize)), sh = Math.max(1, Math.floor(bh / blockSize));
      off.width = sw; off.height = sh;
      const octx = off.getContext('2d');
      octx.imageSmoothingEnabled = false; octx.drawImage(canvas, bx, by, bw, bh, 0, 0, sw, sh);
      ctx.save();
      ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, sw, sh, bx, by, bw, bh);
      ctx.lineWidth = 2; ctx.strokeStyle = (b.id === window.state.selectedBoxId) ? '#d95d39' : 'rgba(217, 93, 57, 0.75)';
      ctx.strokeRect(bx, by, bw, bh);
      if (b.id === window.state.selectedBoxId) {
        ctx.fillStyle = '#d95d39';
        [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]].forEach(([hx, hy]) => ctx.fillRect(hx - 5, hy - 5, 10, 10));
      }
      ctx.restore();
    });
  }

  if (['step-1-2', 'step-2-2'].includes(stepId) || window.state.calibration.active) {
    const cal = s.calibration;
    ctx.save();
    if (cal.topLeft) drawPin(ctx, cal.topLeft.x * canvas.width, cal.topLeft.y * canvas.height, '#d95d39', '1: Sup. Izq');
    if (cal.bottomRight) drawPin(ctx, cal.bottomRight.x * canvas.width, cal.bottomRight.y * canvas.height, '#0d9488', '2: Inf. Dcha');
    if (cal.topLeft && cal.bottomRight) {
      ctx.strokeStyle = '#d95d39'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.strokeRect(cal.topLeft.x * canvas.width, cal.topLeft.y * canvas.height, (cal.bottomRight.x - cal.topLeft.x) * canvas.width, (cal.bottomRight.y - cal.topLeft.y) * canvas.height);
    }
    ctx.restore();
  }
}

function drawPin(ctx, x, y, color, label) {
  ctx.save();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(label, x + 16, y + 4);
  ctx.restore();
}

function initPointerEvents() {
  const canvas = document.getElementById('dni-canvas');
  if (!canvas) return;

  const getNorm = e => {
    const r = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };

  canvas.addEventListener('pointerdown', e => {
    const { x, y } = getNorm(e);
    if (window.state.calibration.active) {
      const s = window.state.sides[window.state.currentSide];
      if (window.state.calibration.step === 1) {
        s.calibration.topLeft = { x, y }; window.state.calibration.step = 2;
        const ind = document.getElementById('calib-indicator'), inst = document.getElementById('calib-instruction');
        if (ind) ind.textContent = 'Paso 2 de 2'; if (inst) inst.innerHTML = 'Ahora toca la <strong>esquina inferior derecha</strong>';
      } else if (window.state.calibration.step === 2) {
        s.calibration.bottomRight = { x: Math.max(s.calibration.topLeft.x + 0.1, x), y: Math.max(s.calibration.topLeft.y + 0.1, y) };
        cancelCalibration();
        const modal = document.getElementById('crop-prompt-modal');
        if (modal) {
          const cw = (s.calibration.bottomRight.x - s.calibration.topLeft.x) * canvas.width;
          const ch = (s.calibration.bottomRight.y - s.calibration.topLeft.y) * canvas.height;
          const desc = document.getElementById('crop-prompt-desc');
          if (desc) {
            desc.textContent = ch > cw * 1.08
              ? 'Has marcado las esquinas de tu DNI (detectado en vertical). ¿Quieres recortar los bordes sobrantes y rotarlo automáticamente a horizontal?'
              : 'Has marcado las esquinas de tu DNI. ¿Quieres recortar la foto para ajustar y encuadrar solo el documento?';
          }
          modal.classList.remove('hidden');
        } else if (window.showToast) {
          window.showToast('✓ Esquinas guardadas con éxito', 'success');
        }
      }
      renderStepCanvas(window.state.wizardStep);
      return;
    }

    if (!['step-1-3', 'step-2-3'].includes(window.state.wizardStep)) return;
    const s = window.state.sides[window.state.currentSide];
    canvas.setPointerCapture(e.pointerId);

    if (window.state.selectedBoxId) {
      const b = s.boxes.find(box => box.id === window.state.selectedBoxId);
      if (b) {
        const tol = 0.05;
        if (Math.hypot(x - b.x, y - b.y) < tol) { window.state.interaction = { mode: 'resizing', handle: 'nw', targetBox: b }; return; }
        if (Math.hypot(x - (b.x + b.width), y - b.y) < tol) { window.state.interaction = { mode: 'resizing', handle: 'ne', targetBox: b }; return; }
        if (Math.hypot(x - (b.x + b.width), y - (b.y + b.height)) < tol) { window.state.interaction = { mode: 'resizing', handle: 'se', targetBox: b }; return; }
        if (Math.hypot(x - b.x, y - (b.y + b.height)) < tol) { window.state.interaction = { mode: 'resizing', handle: 'sw', targetBox: b }; return; }
      }
    }

    const hit = [...s.boxes].reverse().find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
    if (hit) {
      window.state.selectedBoxId = hit.id;
      window.state.interaction = { mode: 'moving', targetBox: hit, dragOffset: { x: x - hit.x, y: y - hit.y } };
    } else {
      window.state.selectedBoxId = null;
      window.state.interaction = { mode: 'drawing', startX: x, startY: y };
    }
    syncPresetChips();
    renderStepCanvas(window.state.wizardStep);
  });

  canvas.addEventListener('pointermove', e => {
    const inter = window.state.interaction;
    if (inter.mode === 'idle') return;
    const { x, y } = getNorm(e), b = inter.targetBox;

    if (inter.mode === 'moving' && b) {
      b.x = Math.max(0, Math.min(1 - b.width, x - inter.dragOffset.x));
      b.y = Math.max(0, Math.min(1 - b.height, y - inter.dragOffset.y));
      renderStepCanvas(window.state.wizardStep);
    } else if (inter.mode === 'resizing' && b) {
      if (inter.handle === 'se') { b.width = Math.max(0.04, x - b.x); b.height = Math.max(0.04, y - b.y); }
      else if (inter.handle === 'sw') { const nx = Math.min(b.x + b.width - 0.04, x); b.width += (b.x - nx); b.x = nx; b.height = Math.max(0.04, y - b.y); }
      else if (inter.handle === 'ne') { const ny = Math.min(b.y + b.height - 0.04, y); b.height += (b.y - ny); b.y = ny; b.width = Math.max(0.04, x - b.x); }
      else if (inter.handle === 'nw') { const nx = Math.min(b.x + b.width - 0.04, x), ny = Math.min(b.y + b.height - 0.04, y); b.width += (b.x - nx); b.x = nx; b.height += (b.y - ny); b.y = ny; }
      renderStepCanvas(window.state.wizardStep);
    }
  });

  const endInteraction = e => {
    const inter = window.state.interaction;
    if (inter.mode === 'drawing') {
      const { x, y } = getNorm(e);
      const rx = Math.min(inter.startX, x), ry = Math.min(inter.startY, y), rw = Math.abs(x - inter.startX), rh = Math.abs(y - inter.startY);
      if (rw > 0.03 && rh > 0.03) {
        const s = window.state.sides[window.state.currentSide];
        const newBox = { id: `box_${Date.now()}`, x: rx, y: ry, width: rw, height: rh, label: 'Zona manual', style: 'pixelate' };
        s.boxes.push(newBox);
        window.state.selectedBoxId = newBox.id;
      }
    }
    if (e.pointerId && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    window.state.interaction = { mode: 'idle' };
    syncPresetChips();
    renderStepCanvas(window.state.wizardStep);
  };

  canvas.addEventListener('pointerup', endInteraction);
  canvas.addEventListener('pointercancel', endInteraction);
}

window.CanvasEngine = {
  mountCanvas, loadCardImage, loadDemoCard, rotateSide, setFineRotation,
  startCalibration, cancelCalibration, resetCalibration, applyCornerCropAndRotate, undoCornerCrop,
  togglePreset, applyAEPD, syncPresetChips, deleteSelectedBox, clearBoxes, renderStepCanvas, initPointerEvents
};
