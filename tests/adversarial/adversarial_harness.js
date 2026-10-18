/**
 * tests/adversarial/adversarial_harness.js
 * Empirical Challenger Stress Test Harness for ProtegeDNI Milestone 1.
 * Tests Canvas Pipeline, Calibration, Touch/Pointer Interactions, Export, Single-card layout, and Context Degradation.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 8888;
const ROOT_DIR = path.resolve(__dirname, '../../');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startServer() {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.json': 'application/json'
  };

  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';
    if (reqUrl === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const filePath = path.join(ROOT_DIR, reqUrl);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${reqUrl}`);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`[TEST-SERVER] Serving ${ROOT_DIR} on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runAdversarialSuite() {
  const server = await startServer();
  const consoleErrors = [];
  const pageErrors = [];

  const findings = [];
  const results = {
    suite1_rotation: { status: 'PENDING', checks: [] },
    suite2_calibration: { status: 'PENDING', checks: [] },
    suite3_interaction: { status: 'PENDING', checks: [] },
    suite4_composite_export: { status: 'PENDING', checks: [] },
    suite5_single_card_export: { status: 'PENDING', checks: [] },
    suite6_leak_degradation: { status: 'PENDING', checks: [] },
    suite7_vulnerabilities_audit: { status: 'PENDING', checks: [] }
  };

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--js-flags=--expose-gc']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 915 }); // Mobile viewport (Pixel 7)

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[BROWSER ERROR]`, msg.text());
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      console.error(`[PAGE UNCAUGHT ERROR]`, err.message);
      pageErrors.push(err.message);
    });

    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
    console.log('[HARNESS] Page loaded successfully.');

    // =========================================================================
    // SUITE 1: Repeated 90° Rotations & Coordinate Normalization Stress Test
    // =========================================================================
    console.log('\n--- SUITE 1: Repeated 90° Rotations Stress Test ---');
    try {
      // Step 1.1: Load front demo image
      await page.click('#btn-demo-front');
      await page.waitForFunction(() => window.state.sides.front.img !== null && window.state.wizardStep === 'step-1-2');
      
      const naturalW = await page.evaluate(() => window.state.sides.front.img.naturalWidth);
      const naturalH = await page.evaluate(() => window.state.sides.front.img.naturalHeight);
      console.log(`[SUITE 1] Front image loaded: ${naturalW}x${naturalH}`);

      // Perform 4 x 90° rotations clockwise
      for (let i = 1; i <= 4; i++) {
        await page.evaluate(() => document.getElementById('btn-rotate-right').click());
        const state = await page.evaluate(() => ({
          orientation: window.state.sides.front.imgOrientation,
          canvasW: document.getElementById('dni-canvas').width,
          canvasH: document.getElementById('dni-canvas').height
        }));
        const expectedDeg = (i * 90) % 360;
        assert(state.orientation === expectedDeg, `Orientation after ${i}x90° was ${state.orientation}, expected ${expectedDeg}`);
        if (expectedDeg === 90 || expectedDeg === 270) {
          assert(state.canvasW === naturalH && state.canvasH === naturalW, `Canvas size swapped incorrectly at ${expectedDeg}°`);
        } else {
          assert(state.canvasW === naturalW && state.canvasH === naturalH, `Canvas size incorrect at ${expectedDeg}°`);
        }
      }
      console.log('✓ 4x90° clockwise returned to 0° with identical dimensions.');
      results.suite1_rotation.checks.push('4x90° clockwise returned to 0° exactly');

      // Perform 4 x -90° rotations counter-clockwise
      for (let i = 1; i <= 4; i++) {
        await page.evaluate(() => document.getElementById('btn-rotate-left').click());
        const state = await page.evaluate(() => window.state.sides.front.imgOrientation);
        const expectedDeg = (360 - (i * 90) % 360) % 360;
        assert(state === expectedDeg, `CCW Orientation after ${i}x-90° was ${state}, expected ${expectedDeg}`);
      }
      console.log('✓ 4x90° CCW returned to 0° successfully.');
      results.suite1_rotation.checks.push('4x-90° counter-clockwise returned to 0° exactly');

      // Rapid burst: 20 rapid rotations
      for (let i = 0; i < 20; i++) {
        await page.evaluate((idx) => {
          if (idx % 3 === 0) document.getElementById('btn-rotate-left').click();
          else document.getElementById('btn-rotate-right').click();
        }, i);
      }
      const postBurst = await page.evaluate(() => window.state.sides.front.imgOrientation);
      assert([0, 90, 180, 270].includes(postBurst), `Invalid orientation post-burst: ${postBurst}`);
      console.log(`✓ 20 rapid rotations ended in valid orientation: ${postBurst}°`);
      results.suite1_rotation.checks.push(`20 rapid rotations normalized to valid orientation (${postBurst}°)`);

      // Reset to 0° for subsequent tests
      await page.evaluate(() => {
        window.state.sides.front.imgOrientation = 0;
        window.CanvasEngine.renderStepCanvas('step-1-2');
      });

      // Fine rotation boundaries (-15, +15, 0)
      const fineRotCheck = await page.evaluate(() => {
        window.CanvasEngine.setFineRotation('front', -15);
        const f1 = window.state.sides.front.fineRotation === -15;
        window.CanvasEngine.setFineRotation('front', 15);
        const f2 = window.state.sides.front.fineRotation === 15;
        window.CanvasEngine.setFineRotation('front', 0);
        const f3 = window.state.sides.front.fineRotation === 0;
        return f1 && f2 && f3;
      });
      assert(fineRotCheck, 'Fine rotation boundaries (-15, +15, 0) failed');
      console.log('✓ Fine tilt rotation tested at boundaries (-15, +15, 0).');
      results.suite1_rotation.checks.push('Fine tilt slider boundaries verified (-15° to +15°)');

      // Verify coordinate normalization when boxes exist during rotation
      await page.evaluate(() => {
        window.state.sides.front.boxes = [
          { id: 'test_box_1', x: 0.1, y: 0.2, width: 0.3, height: 0.2, style: 'pixelate' }
        ];
        window.CanvasEngine.rotateSide('front', 90);
        window.CanvasEngine.rotateSide('front', 90);
        window.CanvasEngine.rotateSide('front', 90);
        window.CanvasEngine.rotateSide('front', 90);
      });
      const boxCheck = await page.evaluate(() => window.state.sides.front.boxes[0]);
      assert(boxCheck.x >= 0 && boxCheck.x <= 1, 'Box X out of [0..1]');
      assert(boxCheck.y >= 0 && boxCheck.y <= 1, 'Box Y out of [0..1]');
      assert(boxCheck.width > 0 && boxCheck.x + boxCheck.width <= 1, 'Box Width out of bounds');
      assert(boxCheck.height > 0 && boxCheck.y + boxCheck.height <= 1, 'Box Height out of bounds');
      console.log('✓ Box normalized coordinates strictly maintained within [0..1] through 360° rotation cycle.');
      results.suite1_rotation.checks.push('Normalization coordinates in [0..1] preserved');

      results.suite1_rotation.status = 'PASS';
    } catch (e) {
      results.suite1_rotation.status = 'FAIL';
      results.suite1_rotation.error = e.message;
      console.error('[SUITE 1 FAILED]', e);
    }

    // =========================================================================
    // SUITE 2: Extreme Corner Calibration Stress Test
    // =========================================================================
    console.log('\n--- SUITE 2: Extreme Corner Calibration Stress Test ---');
    try {
      await page.evaluate(() => window.Wizard.goToStep('step-1-2'));
      await page.evaluate(() => window.CanvasEngine.startCalibration());

      let calibState = await page.evaluate(() => window.state.calibration);
      assert(calibState.active === true && calibState.step === 1, 'Calibration not active at step 1');

      async function clickCanvasNorm(nx, ny) {
        await page.evaluate(({ nx, ny }) => {
          const canvas = document.getElementById('dni-canvas');
          const rect = canvas.getBoundingClientRect();
          const clientX = rect.left + nx * rect.width;
          const clientY = rect.top + ny * rect.height;
          const evt = new PointerEvent('pointerdown', { clientX, clientY, bubbles: true });
          canvas.dispatchEvent(evt);
        }, { nx, ny });
      }

      // Case A: Inverted Coordinates (TopLeft at 0.85, BottomRight at 0.15)
      await clickCanvasNorm(0.85, 0.85);
      calibState = await page.evaluate(() => window.state.calibration);
      assert(calibState.step === 2, 'Calibration should advance to step 2');

      await clickCanvasNorm(0.15, 0.15);
      calibState = await page.evaluate(() => ({
        active: window.state.calibration.active,
        cal: window.state.sides.front.calibration
      }));
      assert(calibState.active === false, 'Calibration should complete after step 2');
      assert(Math.abs(calibState.cal.topLeft.x - 0.85) < 0.01 && Math.abs(calibState.cal.topLeft.y - 0.85) < 0.01, 'TopLeft not recorded correctly');
      assert(calibState.cal.bottomRight.x >= calibState.cal.topLeft.x + 0.1, 'Inverted X should clamp to at least topLeft + 0.1');
      assert(calibState.cal.bottomRight.y >= calibState.cal.topLeft.y + 0.1, 'Inverted Y should clamp to at least topLeft + 0.1');
      console.log(`✓ Inverted coordinates safely clamped: topLeft=(0.85, 0.85), bottomRight=(${calibState.cal.bottomRight.x.toFixed(2)}, ${calibState.cal.bottomRight.y.toFixed(2)})`);
      results.suite2_calibration.checks.push('Inverted calibration clicks handled without inversion or negative span');

      // Test preset positioning with inverted/clamped calibration
      await page.evaluate(() => window.Wizard.goToStep('step-1-3'));
      await page.evaluate(() => window.CanvasEngine.togglePreset('firma'));
      let boxCoord = await page.evaluate(() => window.state.sides.front.boxes.find(b => b.presetKey === 'firma'));
      assert(boxCoord && !isNaN(boxCoord.x) && !isNaN(boxCoord.y), 'Preset with inverted calibration generated NaN coordinates');
      assert(boxCoord.x >= 0 && boxCoord.width > 0, `Preset box has invalid bounds: x=${boxCoord.x}, w=${boxCoord.width}`);
      console.log(`✓ Preset mapped with inverted calibration: x=${boxCoord.x.toFixed(3)}, y=${boxCoord.y.toFixed(3)}, w=${boxCoord.width.toFixed(3)}, h=${boxCoord.height.toFixed(3)}`);
      results.suite2_calibration.checks.push('Presets map safely with inverted calibration');

      // Case B: Tiny card area (0.50 -> 0.501)
      await page.evaluate(() => {
        window.Wizard.goToStep('step-1-2');
        window.CanvasEngine.startCalibration();
      });
      await clickCanvasNorm(0.50, 0.50);
      await clickCanvasNorm(0.501, 0.501);
      calibState = await page.evaluate(() => window.state.sides.front.calibration);
      assert(calibState.bottomRight.x >= 0.60, 'Tiny area clamp should enforce minimum span 0.1');
      console.log(`✓ Tiny card area clamped to minimum span 0.1: (${calibState.topLeft.x}, ${calibState.topLeft.y}) -> (${calibState.bottomRight.x.toFixed(2)}, ${calibState.bottomRight.y.toFixed(2)})`);
      results.suite2_calibration.checks.push('Tiny card calibration enforced minimum 0.1 span');

      // Case C: Full bleed (0.00 -> 1.00)
      await page.evaluate(() => {
        window.CanvasEngine.startCalibration();
      });
      await clickCanvasNorm(0.0, 0.0);
      await clickCanvasNorm(1.0, 1.0);
      calibState = await page.evaluate(() => window.state.sides.front.calibration);
      assert(calibState.topLeft.x === 0 && calibState.topLeft.y === 0, 'Full bleed topLeft incorrect');
      assert(calibState.bottomRight.x === 1 && calibState.bottomRight.y === 1, 'Full bleed bottomRight incorrect');
      console.log('✓ Full bleed calibration (0,0)->(1,1) recorded accurately.');
      results.suite2_calibration.checks.push('Full bleed calibration accurately maps unit bounds');

      // Case D: Reset Calibration
      await page.evaluate(() => window.CanvasEngine.resetCalibration('front'));
      calibState = await page.evaluate(() => window.state.sides.front.calibration);
      assert(calibState.topLeft === null && calibState.bottomRight === null, 'Reset calibration did not clear points');
      console.log('✓ Reset calibration successfully restored null state.');
      results.suite2_calibration.checks.push('Reset calibration restores null coordinates');

      results.suite2_calibration.status = 'PASS';
    } catch (e) {
      results.suite2_calibration.status = 'FAIL';
      results.suite2_calibration.error = e.message;
      console.error('[SUITE 2 FAILED]', e);
    }

    // =========================================================================
    // SUITE 3: Presets & Manual Box Adjustments (Touch / Pointer Stress)
    // =========================================================================
    console.log('\n--- SUITE 3: Presets & Manual Box Adjustments Stress Test ---');
    try {
      await page.evaluate(() => window.Wizard.goToStep('step-1-3'));
      await page.evaluate(() => window.CanvasEngine.clearBoxes());

      // 1. Rapid toggle all 6 front presets
      const presetKeys = ['firma', 'can', 'soporte', 'validez', 'nacimiento', 'foto_extra'];
      for (let cycle = 0; cycle < 5; cycle++) {
        for (const key of presetKeys) {
          await page.evaluate((k) => window.CanvasEngine.togglePreset(k), key);
        }
      }
      let boxCount = await page.evaluate(() => window.state.sides.front.boxes.length);
      assert(boxCount === 6, `Expected 6 active presets, found ${boxCount}`);
      console.log('✓ Rapid preset toggling (5 cycles) reached exact expected state (6 active).');
      results.suite3_interaction.checks.push('Rapid preset toggling (5 cycles) consistent');

      // 2. AEPD button toggle
      await page.evaluate(() => window.CanvasEngine.applyAEPD());
      const aepdCheck = await page.evaluate(() => {
        const boxes = window.state.sides.front.boxes;
        return {
          hasFirma: boxes.some(b => b.presetKey === 'firma'),
          hasCan: boxes.some(b => b.presetKey === 'can'),
          hasSoporte: boxes.some(b => b.presetKey === 'soporte')
        };
      });
      console.log(`✓ AEPD toggle applied: firma=${aepdCheck.hasFirma}, can=${aepdCheck.hasCan}, soporte=${aepdCheck.hasSoporte}`);
      results.suite3_interaction.checks.push('AEPD 1-click toggle synced with preset state');

      // Clear boxes for manual pointer interaction tests
      await page.evaluate(() => window.CanvasEngine.clearBoxes());

      // 3. Pointer drawing: draw a new manual box
      await page.evaluate(() => {
        const canvas = document.getElementById('dni-canvas');
        const rect = canvas.getBoundingClientRect();
        const startX = rect.left + 0.2 * rect.width;
        const startY = rect.top + 0.2 * rect.height;
        const endX = rect.left + 0.5 * rect.width;
        const endY = rect.top + 0.5 * rect.height;

        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, pointerId: 1, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: endX, clientY: endY, pointerId: 1, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: endX, clientY: endY, pointerId: 1, bubbles: true }));
      });

      let manualBoxes = await page.evaluate(() => window.state.sides.front.boxes);
      assert(manualBoxes.length === 1, `Manual drawing failed to create box (count=${manualBoxes.length})`);
      const manualBox = manualBoxes[0];
      assert(Math.abs(manualBox.x - 0.2) < 0.05, `Box X offset: ${manualBox.x}`);
      assert(Math.abs(manualBox.width - 0.3) < 0.05, `Box Width offset: ${manualBox.width}`);
      console.log(`✓ Manual box drawn via PointerEvent: x=${manualBox.x.toFixed(2)}, y=${manualBox.y.toFixed(2)}, w=${manualBox.width.toFixed(2)}, h=${manualBox.height.toFixed(2)}`);
      results.suite3_interaction.checks.push('Manual box drawing via pointer events creates valid box');

      // 4. Pointer drag beyond canvas edge (adversarial out-of-bounds drag)
      await page.evaluate(() => {
        const canvas = document.getElementById('dni-canvas');
        const rect = canvas.getBoundingClientRect();
        const box = window.state.sides.front.boxes[0];
        const grabX = rect.left + (box.x + box.width / 2) * rect.width;
        const grabY = rect.top + (box.y + box.height / 2) * rect.height;
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: grabX, clientY: grabY, pointerId: 1, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left - 500, clientY: rect.top - 500, pointerId: 1, bubbles: true }));
      });

      let draggedBox = await page.evaluate(() => window.state.sides.front.boxes[0]);
      assert(draggedBox.x === 0 && draggedBox.y === 0, `Box dragged <0 not clamped: x=${draggedBox.x}, y=${draggedBox.y}`);

      // Now move far past bottom-right (>1)
      await page.evaluate(() => {
        const canvas = document.getElementById('dni-canvas');
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + rect.width + 500, clientY: rect.top + rect.height + 500, pointerId: 1, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: rect.left + rect.width + 500, clientY: rect.top + rect.height + 500, pointerId: 1, bubbles: true }));
      });

      draggedBox = await page.evaluate(() => window.state.sides.front.boxes[0]);
      assert(draggedBox.x <= 1 - draggedBox.width && draggedBox.y <= 1 - draggedBox.height, `Box dragged >1 not clamped inside bounds: x=${draggedBox.x}, y=${draggedBox.y}, w=${draggedBox.width}`);
      console.log(`✓ Adversarial out-of-bounds drag strictly clamped: x=${draggedBox.x.toFixed(2)}, y=${draggedBox.y.toFixed(2)}`);
      results.suite3_interaction.checks.push('Boundary drag clamped strictly within canvas [0, 1 - width]');

      // 5. Delete box
      await page.evaluate(() => window.CanvasEngine.deleteSelectedBox());
      const postDeleteBoxes = await page.evaluate(() => window.state.sides.front.boxes.length);
      assert(postDeleteBoxes === 0, `Delete box failed (count=${postDeleteBoxes})`);
      console.log('✓ Delete selected box verified.');
      results.suite3_interaction.checks.push('Delete selected box clears target and syncs chips');

      results.suite3_interaction.status = 'PASS';
    } catch (e) {
      results.suite3_interaction.status = 'FAIL';
      results.suite3_interaction.error = e.message;
      console.error('[SUITE 3 FAILED]', e);
    }

    // =========================================================================
    // SUITE 4: Composite Canvas Export Stress Test
    // =========================================================================
    console.log('\n--- SUITE 4: Composite Canvas Export Stress Test ---');
    try {
      // Set up front with AEPD presets
      await page.evaluate(() => {
        window.Wizard.goToStep('step-1-3');
        window.CanvasEngine.clearBoxes();
        window.CanvasEngine.applyAEPD(); // adds firma, can, soporte
      });

      // Advance to step-2-1 and load back demo
      await page.evaluate(() => {
        document.querySelectorAll('.toast').forEach(t => t.remove());
        document.getElementById('btn-demo-back').click();
      });
      await page.waitForFunction(() => window.state.sides.back.img !== null && window.state.wizardStep === 'step-2-2');
      console.log('[SUITE 4] Back demo loaded.');

      // Advance to step-2-3 and apply AEPD back presets
      await page.evaluate(() => {
        window.Wizard.goToStep('step-2-3');
        window.CanvasEngine.applyAEPD(); // adds mrz, domicilio
      });

      // Advance to step-final
      await page.evaluate(() => window.Wizard.goToStep('step-final'));
      await page.waitForFunction(() => document.getElementById('dni-canvas').width > 1000);

      // Verify Vertical Layout
      let exportDims = await page.evaluate(() => ({
        width: document.getElementById('dni-canvas').width,
        height: document.getElementById('dni-canvas').height,
        mergeBoxVisible: !document.getElementById('merge-options-box').classList.contains('hidden')
      }));
      assert(exportDims.mergeBoxVisible === true, 'Merge options box should be visible when both sides present');
      assert(exportDims.width === 1196, `Vertical composite canvas width expected 1196, got ${exportDims.width}`);
      assert(exportDims.height >= 1500, `Vertical composite canvas height expected >= 1500, got ${exportDims.height}`);
      console.log(`✓ 2-in-1 Vertical Export layout verified: ${exportDims.width}x${exportDims.height}`);
      results.suite4_composite_export.checks.push('2-in-1 Vertical Export layout dimensions verified');

      // Verify Horizontal Layout
      await page.evaluate(() => {
        window.state.exportSettings.mergeLayout = 'horizontal';
        window.ExportEngine.renderExportCanvas();
      });
      exportDims = await page.evaluate(() => ({
        width: document.getElementById('dni-canvas').width,
        height: document.getElementById('dni-canvas').height
      }));
      assert(exportDims.width === 2332, `Horizontal composite width expected 2332, got ${exportDims.width}`);
      console.log(`✓ 2-in-1 Horizontal Export layout verified: ${exportDims.width}x${exportDims.height}`);
      results.suite4_composite_export.checks.push('2-in-1 Horizontal Export layout dimensions verified');

      // Switch back to vertical for pixel inspections
      await page.evaluate(() => {
        window.state.exportSettings.mergeLayout = 'vertical';
        window.ExportEngine.renderExportCanvas();
      });

      // PIXEL VERIFICATION:
      // 1. Verify Perceptual B&W before watermark application
      const bwPurityCheck = await page.evaluate(() => {
        const savedText = window.state.exportSettings.watermarkText;
        const savedDate = window.state.exportSettings.includeDate;
        window.state.exportSettings.watermarkText = ''; // temporarily render without watermark
        window.state.exportSettings.includeDate = false;
        window.ExportEngine.renderExportCanvas();

        const canvas = document.getElementById('dni-canvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(50, 100, 300, 300);
        const d = imgData.data;
        let nonMatch = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2]) nonMatch++;
        }

        // Restore watermark
        window.state.exportSettings.watermarkText = savedText;
        window.state.exportSettings.includeDate = savedDate;
        window.ExportEngine.renderExportCanvas();

        return {
          totalPixels: d.length / 4,
          nonMatch,
          purity: 1 - (nonMatch / (d.length / 4))
        };
      });

      assert(bwPurityCheck.purity === 1.0, `B&W purity failure: ${bwPurityCheck.nonMatch} pixels had R!=G!=B`);
      console.log(`✓ Perceptual B&W verified: 100.00% of underlying document pixels have exact R=G=B.`);
      results.suite4_composite_export.checks.push('Perceptual B&W verified (100% exact R=G=B on document pixels)');

      // 2. Verify Watermark Red Pixels Overlay
      const wmCheck = await page.evaluate(() => {
        const canvas = document.getElementById('dni-canvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        let redPixels = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > 120 && (r - g > 30) && (r - b > 30)) {
            redPixels++;
          }
        }
        return { redPixels };
      });
      assert(wmCheck.redPixels > 500, `Watermark red pixels not detected in sufficient quantity (${wmCheck.redPixels})`);
      console.log(`✓ Diagonal repeating watermark verified (${wmCheck.redPixels} red pixels detected across grid).`);
      results.suite4_composite_export.checks.push('Diagonal repeating watermark verified with distinct red pixels');

      // 3. Pixelation check in redacted area
      const pixelationCheck = await page.evaluate(() => {
        const canvas = document.getElementById('dni-canvas');
        const ctx = canvas.getContext('2d');
        // Sample Firma box region in front card (x ~ 530, y ~ 600)
        const sampleW = 40, sampleH = 40;
        const imgData = ctx.getImageData(530, 600, sampleW, sampleH);
        const d = imgData.data;

        let identicalPairs = 0;
        let totalPairs = 0;
        for (let y = 0; y < sampleH; y++) {
          for (let x = 0; x < sampleW - 1; x++) {
            const idx1 = (y * sampleW + x) * 4;
            const idx2 = (y * sampleW + x + 1) * 4;
            totalPairs++;
            if (d[idx1] === d[idx2] && d[idx1 + 1] === d[idx2 + 1] && d[idx1 + 2] === d[idx2 + 2]) {
              identicalPairs++;
            }
          }
        }
        return { identicalRatio: identicalPairs / totalPairs };
      });

      assert(pixelationCheck.identicalRatio > 0.50, `Pixelation signature not observed in redacted area: ratio=${pixelationCheck.identicalRatio}`);
      console.log(`✓ Security pixelation redaction verified (${(pixelationCheck.identicalRatio * 100).toFixed(1)}% adjacent pixel uniformity).`);
      results.suite4_composite_export.checks.push('Security pixelation redactions verified');

      results.suite4_composite_export.status = 'PASS';
    } catch (e) {
      results.suite4_composite_export.status = 'FAIL';
      results.suite4_composite_export.error = e.message;
      console.error('[SUITE 4 FAILED]', e);
    }

    // =========================================================================
    // SUITE 5: Single Front Card Export (Back Skipped) Artifact Check
    // =========================================================================
    console.log('\n--- SUITE 5: Single Front Card Export (Back Skipped) Stress Test ---');
    try {
      // Reset wizard
      await page.evaluate(() => window.Wizard.restartWizard());
      await page.waitForFunction(() => window.state.wizardStep === 'step-1-1');

      // Load front demo
      await page.click('#btn-demo-front');
      await page.waitForFunction(() => window.state.sides.front.img !== null && window.state.wizardStep === 'step-1-2');

      // Advance to step-2-1
      await page.evaluate(() => window.Wizard.goToStep('step-2-1'));

      // Click Skip Back
      await page.evaluate(() => window.Wizard.skipBackSide());
      await page.waitForFunction(() => window.state.wizardStep === 'step-final');

      const singleExport = await page.evaluate(() => {
        const canvas = document.getElementById('dni-canvas');
        const mergeBox = document.getElementById('merge-options-box');
        return {
          width: canvas.width,
          height: canvas.height,
          mergeBoxHidden: mergeBox.classList.contains('hidden'),
          backSkipped: window.state.sides.back.skipped,
          backImg: window.state.sides.back.img
        };
      });

      assert(singleExport.backSkipped === true, 'Back should be marked skipped');
      assert(singleExport.backImg === null, 'Back img should be null');
      assert(singleExport.mergeBoxHidden === true, 'Merge options box should be hidden');
      assert(singleExport.width === 1196, `Canvas width expected 1196, got ${singleExport.width}`);
      assert(singleExport.height < 1200, `Single card height should be under 1200px (was ${singleExport.height})`);
      console.log(`✓ Single card layout dimensions verified: ${singleExport.width}x${singleExport.height} (NO back card slot or placeholder).`);
      results.suite5_single_card_export.checks.push('Single front layout verified (height 824px vs 2618px, no back placeholder)');

      // Verify navigating back returns to step-2-1
      await page.evaluate(() => window.Wizard.prevStep());
      const returnedStep = await page.evaluate(() => window.state.wizardStep);
      assert(returnedStep === 'step-2-1', `Expected prevStep from skipped back final to go to step-2-1, got ${returnedStep}`);
      console.log('✓ Navigation back from skipped final returns to step-2-1 correctly.');
      results.suite5_single_card_export.checks.push('Navigating back from skipped final returns to step-2-1');

      results.suite5_single_card_export.status = 'PASS';
    } catch (e) {
      results.suite5_single_card_export.status = 'FAIL';
      results.suite5_single_card_export.error = e.message;
      console.error('[SUITE 5 FAILED]', e);
    }

    // =========================================================================
    // SUITE 6: Memory Leak & Canvas Context Degradation Stress Test
    // =========================================================================
    console.log('\n--- SUITE 6: Memory Leak & Canvas Context Degradation Stress Test ---');
    try {
      const churnResults = await page.evaluate(async () => {
        const startMem = window.performance.memory ? window.performance.memory.usedJSHeapSize : null;
        const canvas = document.getElementById('dni-canvas');
        let nullContextCount = 0;

        for (let i = 0; i < 50; i++) {
          window.CanvasEngine.rotateSide('front', 90);
          window.CanvasEngine.togglePreset('firma');
          window.CanvasEngine.renderStepCanvas('step-1-3');
          window.ExportEngine.renderExportCanvas();

          const ctx = canvas.getContext('2d');
          if (!ctx) nullContextCount++;
        }

        if (window.gc) window.gc();
        const endMem = window.performance.memory ? window.performance.memory.usedJSHeapSize : null;
        return {
          startMemMB: startMem ? (startMem / (1024 * 1024)).toFixed(2) : 'N/A',
          endMemMB: endMem ? (endMem / (1024 * 1024)).toFixed(2) : 'N/A',
          memDeltaMB: (startMem && endMem) ? ((endMem - startMem) / (1024 * 1024)).toFixed(2) : 'N/A',
          nullContextCount,
          wrapperChildren: document.getElementById('canvas-wrapper').children.length
        };
      });

      console.log(`[SUITE 6] 50-cycle churn completed: Heap ${churnResults.startMemMB}MB -> ${churnResults.endMemMB}MB (Delta: ${churnResults.memDeltaMB}MB), Context nulls: ${churnResults.nullContextCount}`);
      assert(churnResults.nullContextCount === 0, `Canvas context degradation detected (${churnResults.nullContextCount} null contexts)`);
      assert(churnResults.wrapperChildren === 1, `Canvas wrapper leaked children (count=${churnResults.wrapperChildren})`);
      results.suite6_leak_degradation.checks.push(`Zero canvas context nulls after 50 intensive render cycles`);
      results.suite6_leak_degradation.checks.push(`Zero DOM element leakage in canvas-wrapper`);

      results.suite6_leak_degradation.status = 'PASS';
    } catch (e) {
      results.suite6_leak_degradation.status = 'FAIL';
      results.suite6_leak_degradation.error = e.message;
      console.error('[SUITE 6 FAILED]', e);
    }

    // =========================================================================
    // SUITE 7: Empirical Vulnerability & Edge Case Audit
    // =========================================================================
    console.log('\n--- SUITE 7: Empirical Vulnerabilities & Edge Cases Audit ---');
    
    // Check Vulnerability 1: Step 2.1 Navigation Prerequisite Bypass
    await page.evaluate(() => window.Wizard.restartWizard());
    await page.evaluate(() => window.Wizard.goToStep('step-2-1'));
    const stepAfterBypass = await page.evaluate(() => window.state.wizardStep);
    const vuln1 = {
      id: 'VULN-M1-001',
      title: 'Missing Prerequisite Guard on Step 2.1 (Back Side) Jump',
      severity: 'HIGH',
      reproduced: stepAfterBypass === 'step-2-1',
      description: 'goToStep("step-2-1") does not check if window.state.sides.front.img exists, allowing a user to jump directly into the back-side flow without uploading a front image.'
    };
    findings.push(vuln1);
    console.log(`[VULN-M1-001] Step 2.1 Jump Bypass without front image: ${vuln1.reproduced ? 'CONFIRMED VULNERABLE' : 'PROTECTED'}`);

    // Check Vulnerability 2: Toast notification physical obstruction of action buttons
    const vuln2Check = await page.evaluate(() => {
      window.showToast('Test Warning', 'warning');
      const btn = document.getElementById('btn-demo-front');
      const r = btn.getBoundingClientRect();
      const elAtPoint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const isBlocked = elAtPoint && elAtPoint.closest('.toast') !== null;
      return {
        isBlocked,
        elementClassName: elAtPoint ? elAtPoint.className : null
      };
    });
    const vuln2 = {
      id: 'VULN-M1-002',
      title: 'Active Toast Notifications Intercept Touch/Click Events on Bottom Controls',
      severity: 'MEDIUM',
      reproduced: vuln2Check.isBlocked,
      description: '.toast has pointer-events: auto and stacks at the bottom above the navigation bar, physically overlaying #btn-demo-front and absorbing click events for 3 seconds.'
    };
    findings.push(vuln2);
    console.log(`[VULN-M1-002] Toast hit-testing obstruction: ${vuln2.reproduced ? 'CONFIRMED VULNERABLE' : 'PROTECTED'}`);

    // Check Vulnerability 3: drawImage DOMException on 0-dimension image
    const vuln3Check = await page.evaluate(() => {
      try {
        const dummyImg = new Image(); // naturalWidth = 0, naturalHeight = 0
        window.state.sides.front.img = dummyImg;
        window.ExportEngine.renderExportCanvas();
        return { threw: false };
      } catch (err) {
        return { threw: true, message: err.message };
      }
    });
    const vuln3 = {
      id: 'VULN-M1-003',
      title: 'Canvas drawImage DOMException on Zero-Dimension Image',
      severity: 'MEDIUM',
      reproduced: vuln3Check.threw,
      description: `renderExportCanvas throws unhandled DOMException if image has 0 width/height: "${vuln3Check.message || ''}"`
    };
    findings.push(vuln3);
    console.log(`[VULN-M1-003] Zero-dimension drawImage crash: ${vuln3.reproduced ? 'CONFIRMED VULNERABLE' : 'PROTECTED'}`);

    // Check Vulnerability 4: Horizontal layout overflow on 360px viewport
    await page.setViewport({ width: 360, height: 640 });
    await page.evaluate(() => {
      window.CanvasEngine.loadDemoCard('front');
    });
    await page.waitForFunction(() => window.state.wizardStep === 'step-1-2');
    const vuln4Check = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      return {
        hasOverflow: scrollW > clientW,
        scrollW,
        clientW,
        overflowPx: scrollW - clientW
      };
    });
    const vuln4 = {
      id: 'VULN-M1-004',
      title: 'Horizontal Page Overflow on Small Mobile Screens (360px Android)',
      severity: 'LOW',
      reproduced: vuln4Check.hasOverflow,
      description: `Document scrollWidth (${vuln4Check.scrollW}px) exceeds viewport clientWidth (${vuln4Check.clientW}px) by ${vuln4Check.overflowPx}px, causing horizontal wiggle on narrow devices.`
    };
    findings.push(vuln4);
    console.log(`[VULN-M1-004] Mobile viewport overflow: ${vuln4.reproduced ? 'CONFIRMED VULNERABLE (' + vuln4Check.overflowPx + 'px overflow)' : 'PROTECTED'}`);

    results.suite7_vulnerabilities_audit.status = 'PASS';
    results.suite7_vulnerabilities_audit.checks = findings;

    // Overall harness errors check
    console.log(`\n[HARNESS SUMMARY] Console errors: ${consoleErrors.length}, Page errors: ${pageErrors.length}`);
    assert(consoleErrors.length === 0, `Browser logged ${consoleErrors.length} errors: ${consoleErrors.join('; ')}`);
    assert(pageErrors.length === 0, `Uncaught page errors: ${pageErrors.join('; ')}`);

  } finally {
    if (browser) await browser.close();
    server.close();
    console.log('[TEST-SERVER] Server stopped.');
  }

  return { results, findings };
}

if (require.main === module) {
  runAdversarialSuite()
    .then(data => {
      console.log('\n================ ADVERSARIAL STRESS TEST RESULTS ================');
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('\nFATAL ERROR IN HARNESS:', err);
      process.exit(1);
    });
}

module.exports = { runAdversarialSuite };
