/**
 * export-engine.js - Master Composite Document, Safe Defaults, Download & WhatsApp Sharing
 */
function renderCardOffscreen(sideObj) {
  if (!sideObj || !sideObj.img || !sideObj.img.naturalWidth || !sideObj.img.naturalHeight) return null;
  const off = document.createElement('canvas');
  const isRot = (sideObj.imgOrientation % 180 !== 0);
  const w = isRot ? sideObj.img.naturalHeight : sideObj.img.naturalWidth;
  const h = isRot ? sideObj.img.naturalWidth : sideObj.img.naturalHeight;
  off.width = w; off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((sideObj.imgOrientation + sideObj.fineRotation) * Math.PI / 180);
  const dw = isRot ? h : w, dh = isRot ? w : h;
  ctx.drawImage(sideObj.img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (sideObj.boxes && sideObj.boxes.length > 0) {
    const blockSize = Math.max(6, Math.round(18 * (w / 900)));
    sideObj.boxes.forEach(b => {
      const bx = Math.max(0, Math.round(b.x * w));
      const by = Math.max(0, Math.round(b.y * h));
      const bw = Math.min(w - bx, Math.round(b.width * w));
      const bh = Math.min(h - by, Math.round(b.height * h));
      if (bw <= 0 || bh <= 0) return;

      const pOff = document.createElement('canvas');
      const sw = Math.max(1, Math.floor(bw / blockSize)), sh = Math.max(1, Math.floor(bh / blockSize));
      pOff.width = sw; pOff.height = sh;
      const pctx = pOff.getContext('2d');
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(off, bx, by, bw, bh, 0, 0, sw, sh);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pOff, 0, 0, sw, sh, bx, by, bw, bh);
      ctx.restore();
    });
  }
  return off;
}

function renderExportCanvas() {
  const canvas = document.getElementById('dni-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const frontOff = renderCardOffscreen(window.state.sides.front);
  const backOff = (!window.state.sides.back.skipped) ? renderCardOffscreen(window.state.sides.back) : null;

  if (!frontOff || frontOff.width <= 0 || frontOff.height <= 0) {
    canvas.width = 600; canvas.height = 380;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 600, 380);
    return;
  }

  const CARD_W = 1100;
  const pad = 48, gap = 36, headerH = 28;
  const fW = CARD_W, fH = Math.round(frontOff.height * (CARD_W / frontOff.width));
  const mergeBox = document.getElementById('merge-options-box');

  if (backOff && backOff.width > 0 && backOff.height > 0) {
    if (mergeBox) mergeBox.classList.remove('hidden');
    const bW = CARD_W, bH = Math.round(backOff.height * (CARD_W / backOff.width));
    const isHoriz = window.state.exportSettings.mergeLayout === 'horizontal';

    if (isHoriz) {
      canvas.width = CARD_W * 2 + pad * 2 + gap;
      canvas.height = Math.max(fH, bH) + pad * 2 + headerH;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCardWithShadow(ctx, frontOff, pad, pad + headerH, fW, fH, '🪪 ANVERSO');
      drawCardWithShadow(ctx, backOff, pad + CARD_W + gap, pad + headerH, bW, bH, '🔄 REVERSO');
    } else {
      canvas.width = CARD_W + pad * 2;
      canvas.height = pad * 2 + (headerH + fH) + gap + (headerH + bH);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCardWithShadow(ctx, frontOff, pad, pad + headerH, fW, fH, '🪪 ANVERSO');
      drawCardWithShadow(ctx, backOff, pad, pad + headerH + fH + gap + headerH, bW, bH, '🔄 REVERSO');
    }
  } else {
    if (mergeBox) mergeBox.classList.add('hidden');
    canvas.width = CARD_W + pad * 2;
    canvas.height = pad * 2 + headerH + fH;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCardWithShadow(ctx, frontOff, pad, pad + headerH, fW, fH, '🪪 ANVERSO');
  }

  applyBlackAndWhite(ctx, canvas.width, canvas.height);
  applyWatermark(ctx, canvas.width, canvas.height);
}

function drawCardWithShadow(ctx, off, x, y, w, h, title) {
  if (!off || off.width <= 0 || off.height <= 0) return;
  ctx.save();
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(title, x, y - 8);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(off, x, y, w, h);
  ctx.restore();
}

function applyBlackAndWhite(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const contrast = 1.15;
  for (let i = 0; i < d.length; i += 4) {
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray = (gray - 128) * contrast + 128;
    gray = Math.max(0, Math.min(255, gray));
    d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyWatermark(ctx, width, height) {
  let text = (window.state.exportSettings.watermarkText || '').trim();
  if (window.state.exportSettings.includeDate && window.state.exportSettings.watermarkDate) {
    text += ` · ${window.state.exportSettings.watermarkDate}`;
  }
  if (!text) return;

  ctx.save();
  ctx.globalAlpha = 0.38;
  const fontSize = Math.max(16, Math.round(width / 38));
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-28 * Math.PI / 180);

  const textWidth = ctx.measureText(text).width;
  const stepX = Math.max(textWidth + 80, 240);
  const stepY = fontSize * 3.8;
  const diag = Math.hypot(width, height);

  let row = 0;
  for (let y = -diag; y < diag; y += stepY) {
    const shiftX = (row % 2 === 0) ? 0 : stepX / 2;
    for (let x = -diag; x < diag; x += stepX) {
      ctx.lineWidth = Math.max(2, fontSize / 7);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(text, x + shiftX, y);
      ctx.fillStyle = '#d92626';
      ctx.fillText(text, x + shiftX, y);
    }
    row++;
  }
  ctx.restore();
}

function downloadImage(overrideFormat) {
  const canvas = document.getElementById('dni-canvas');
  if (!canvas) return;
  renderExportCanvas();

  const format = overrideFormat || window.state.exportSettings.format || 'image/jpeg';
  const ext = format === 'image/jpeg' ? 'jpg' : 'png';
  const quality = format === 'image/jpeg' ? 0.92 : undefined;
  const dataUrl = canvas.toDataURL(format, quality);

  const link = document.createElement('a');
  link.download = `DNI_Protegido_${Date.now()}.${ext}`;
  link.href = dataUrl;
  link.click();
  if (window.showToast) window.showToast('✓ Descarga iniciada', 'success');
}

async function copyOrShareForWhatsApp() {
  const canvas = document.getElementById('dni-canvas');
  if (!canvas) return;
  const btn = document.getElementById('btn-copy-clipboard');
  if (btn) btn.disabled = true;

  try {
    renderExportCanvas();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Blob creation failed');

    const file = new File([blob], `DNI_Protegido_${Date.now()}.png`, { type: 'image/png' });

    // Tier 1: Web Share API with Files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'DNI Protegido', text: 'DNI Protegido para verificación' });
        if (window.showToast) window.showToast('✓ Compartido para WhatsApp', 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Tier 2: Async Clipboard API
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        if (window.showToast) window.showToast('✓ ¡Copiado al portapapeles! Pégalo en WhatsApp', 'success');
        return;
      } catch (err) {
        console.warn('Clipboard write failed, falling back to download:', err);
      }
    }

    // Tier 3: Direct Download Fallback
    downloadImage('image/png');
    if (window.showToast) window.showToast('✓ DNI descargado para adjuntar en WhatsApp', 'info');
  } catch (e) {
    downloadImage('image/png');
    if (window.showToast) window.showToast('✓ DNI descargado para WhatsApp', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.ExportEngine = { renderExportCanvas, downloadImage, copyOrShareForWhatsApp };
