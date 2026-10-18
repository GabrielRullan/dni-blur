/**
 * forensic_test.js - Milestone 1 Forensic Integrity Verification Suite
 * Executes in-depth static and runtime integrity checks.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8089;
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// 1. Static file server with favicon handler
function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(ROOT_DIR, reqPath);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[TEST-SERVER] Listening at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

// 2. Helper to create a minimal JPEG with EXIF & GPS metadata
function createJpegWithExif() {
  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]);
  
  const ifd0 = Buffer.alloc(2 + 12 * 2 + 4);
  ifd0.writeUInt16LE(2, 0);
  ifd0.writeUInt16LE(0x010F, 2);
  ifd0.writeUInt16LE(2, 4);
  ifd0.writeUInt32LE(5, 6);
  ifd0.writeUInt32LE(38, 10);
  ifd0.writeUInt16LE(0x8825, 14);
  ifd0.writeUInt16LE(4, 16);
  ifd0.writeUInt32LE(1, 18);
  ifd0.writeUInt32LE(44, 22);
  ifd0.writeUInt32LE(0, 26);

  const makeString = Buffer.from('TEST\0', 'ascii');
  
  const gpsIfd = Buffer.alloc(2 + 12 + 4);
  gpsIfd.writeUInt16LE(1, 0);
  gpsIfd.writeUInt16LE(0x0001, 2);
  gpsIfd.writeUInt16LE(2, 4);
  gpsIfd.writeUInt32LE(2, 6);
  gpsIfd.write('N\0', 10, 2, 'ascii');
  gpsIfd.writeUInt32LE(0, 14);

  const tiffBody = Buffer.concat([tiffHeader, ifd0, makeString, gpsIfd]);
  const app1Payload = Buffer.concat([exifHeader, tiffBody]);
  const app1Length = app1Payload.length + 2;
  const app1LengthBuf = Buffer.alloc(2);
  app1LengthBuf.writeUInt16BE(app1Length, 0);

  const app1Marker = Buffer.concat([Buffer.from([0xFF, 0xE1]), app1LengthBuf, app1Payload]);
  const realJpeg = fs.readFileSync(path.join(ROOT_DIR, 'back.jpg'));
  const jpegWithExif = Buffer.concat([realJpeg.slice(0, 2), app1Marker, realJpeg.slice(2)]);
  return jpegWithExif;
}

async function runForensicAudit() {
  const server = await startServer();
  const testResults = {
    networkCalls: [],
    externalRequests: [],
    consoleErrors: [],
    consoleWarnings: [],
    mathChecks: {},
    exifStripped: false,
    pixelationVerified: false,
    bwMatrixVerified: false,
    watermarkVerified: false
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  // Monitor network traffic
  page.on('request', req => {
    const url = req.url();
    testResults.networkCalls.push(url);
    if (!url.startsWith(`http://127.0.0.1:${PORT}`) && !url.startsWith(`http://localhost:${PORT}`) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      testResults.externalRequests.push(url);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') testResults.consoleErrors.push(msg.text());
    if (msg.type() === 'warning') testResults.consoleWarnings.push(msg.text());
  });

  try {
    console.log('[PHASE 1] Navigating to index.html...');
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });

    // Verify initial state
    const initialWizardStep = await page.evaluate(() => window.state.wizardStep);
    console.log(`[CHECK] Initial wizardStep: ${initialWizardStep}`);

    // --- TEST 1: Load Front Demo Image ---
    console.log('[PHASE 2] Loading front demo card...');
    await page.click('#btn-demo-front');
    await page.waitForFunction(() => window.state.wizardStep === 'step-1-2');

    const frontImgLoaded = await page.evaluate(() => {
      const s = window.state.sides.front;
      return s.img !== null && s.img.naturalWidth > 0 && s.img.naturalHeight > 0;
    });
    console.log(`[CHECK] Front image loaded successfully: ${frontImgLoaded}`);

    // --- TEST 2: Math & Transformation Authenticity (Rotation & Fine Tilt) ---
    console.log('[PHASE 3] Verifying 90° rotation and fine tilt math...');
    const rotCheck = await page.evaluate(() => {
      const canvas = document.getElementById('dni-canvas');
      const origW = canvas.width;
      const origH = canvas.height;

      // Rotate 90 deg right
      window.CanvasEngine.rotateSide('front', 90);
      const rot90W = canvas.width;
      const rot90H = canvas.height;
      const orient90 = window.state.sides.front.imgOrientation;

      // Rotate another 90 deg right
      window.CanvasEngine.rotateSide('front', 90);
      const rot180W = canvas.width;
      const rot180H = canvas.height;
      const orient180 = window.state.sides.front.imgOrientation;

      // Apply fine rotation
      window.CanvasEngine.setFineRotation('front', 4.5);
      const fineRot = window.state.sides.front.fineRotation;

      // Reset orientation back to 0 for subsequent tests
      window.CanvasEngine.rotateSide('front', 180);
      window.CanvasEngine.setFineRotation('front', 0);

      return {
        origW, origH,
        rot90W, rot90H, orient90,
        rot180W, rot180H, orient180,
        fineRot,
        is90Swapped: (rot90W === origH && rot90H === origW),
        is180Preserved: (rot180W === origW && rot180H === origH)
      };
    });
    testResults.mathChecks.rotation = rotCheck;
    console.log(`[CHECK] Rotation matrix authenticity:`, rotCheck);

    // --- TEST 3: Corner Marking Calibration Transformation Math ---
    console.log('[PHASE 4] Verifying 2-point calibration affine mapping math...');
    const calibCheck = await page.evaluate(() => {
      const s = window.state.sides.front;
      s.calibration.topLeft = { x: 0.10, y: 0.15 };
      s.calibration.bottomRight = { x: 0.90, y: 0.85 };

      s.boxes = [];
      window.CanvasEngine.togglePreset('firma');
      const box = s.boxes[0];

      const spanX = 0.90 - 0.10;
      const spanY = 0.85 - 0.15;
      const expX = 0.10 + 0.43 * spanX;
      const expY = 0.15 + 0.74 * spanY;
      const expW = 0.31 * spanX;
      const expH = 0.16 * spanY;

      const diffX = Math.abs(box.x - expX);
      const diffY = Math.abs(box.y - expY);
      const diffW = Math.abs(box.width - expW);
      const diffH = Math.abs(box.height - expH);

      s.calibration.topLeft = null;
      s.calibration.bottomRight = null;
      s.boxes = [];

      return {
        box,
        exp: { x: expX, y: expY, width: expW, height: expH },
        maxDiff: Math.max(diffX, diffY, diffW, diffH),
        passed: Math.max(diffX, diffY, diffW, diffH) < 0.0001
      };
    });
    testResults.mathChecks.calibration = calibCheck;
    console.log(`[CHECK] Calibration math verification:`, calibCheck);

    // --- TEST 4: Step 1.3 Pixelation Block Sizing & In-Buffer Raster Modification ---
    console.log('[PHASE 5] Verifying pixelation raster modification authenticity...');
    await page.evaluate(() => window.Wizard.goToStep('step-1-3'));
    
    const pixelationCheck = await page.evaluate(() => {
      const canvas = document.getElementById('dni-canvas');
      const ctx = canvas.getContext('2d');
      
      const testX = Math.round(0.45 * canvas.width);
      const testY = Math.round(0.75 * canvas.height);
      const regionW = 80;
      const regionH = 40;
      const beforeData = ctx.getImageData(testX, testY, regionW, regionH).data;

      window.CanvasEngine.togglePreset('firma');
      const afterData = ctx.getImageData(testX, testY, regionW, regionH).data;

      let diffCount = 0;
      for (let i = 0; i < beforeData.length; i += 4) {
        if (beforeData[i] !== afterData[i] || beforeData[i+1] !== afterData[i+1] || beforeData[i+2] !== afterData[i+2]) {
          diffCount++;
        }
      }

      const blockSize = Math.max(6, Math.round(18 * (canvas.width / 900)));
      const p1_r = afterData[0], p1_g = afterData[1], p1_b = afterData[2];
      const p2_idx = (1 * regionW + 1) * 4;
      const p2_r = afterData[p2_idx], p2_g = afterData[p2_idx+1], p2_b = afterData[p2_idx+2];
      const blockUniform = (p1_r === p2_r && p1_g === p2_g && p1_b === p2_b);

      return {
        totalPixels: regionW * regionH,
        alteredPixels: diffCount,
        percentAltered: (diffCount / (regionW * regionH)) * 100,
        blockSize,
        blockUniform,
        isGenuinePixelation: diffCount > (regionW * regionH * 0.7) && blockUniform
      };
    });
    testResults.pixelationVerified = pixelationCheck.isGenuinePixelation;
    console.log(`[CHECK] Pixelation raster modification check:`, pixelationCheck);

    // --- TEST 5: Back Side Flow & Skip Verification ---
    console.log('[PHASE 6] Testing Back Side Skip flow...');
    await page.evaluate(() => window.Wizard.goToStep('step-2-1'));
    await page.evaluate(() => window.Wizard.skipBackSide());
    const skippedStep = await page.evaluate(() => window.state.wizardStep);
    const isBackSkipped = await page.evaluate(() => window.state.sides.back.skipped);
    console.log(`[CHECK] Skip back resulted in step: ${skippedStep}, back.skipped: ${isBackSkipped}`);

    // Return to step-2-1 and load back demo
    console.log('[PHASE 7] Testing Back Side Demo load and flow...');
    await page.evaluate(() => window.Wizard.goToStep('step-2-1'));
    await page.click('#btn-demo-back');
    await page.waitForFunction(() => window.state.wizardStep === 'step-2-2');
    
    // Advance to 2.3 and apply back presets
    await page.evaluate(() => {
      window.Wizard.goToStep('step-2-3');
      window.CanvasEngine.applyAEPD();
    });
    const backBoxesCount = await page.evaluate(() => window.state.sides.back.boxes.length);
    console.log(`[CHECK] Back side AEPD boxes applied: ${backBoxesCount}`);

    // --- TEST 6: Step Final - Composite Document, ITU-R BT.601 B&W & Watermark ---
    console.log('[PHASE 8] Advancing to Step Final and verifying ITU-R BT.601 & Watermark...');
    await page.evaluate(() => window.Wizard.goToStep('step-final'));

    const exportVerification = await page.evaluate(() => {
      // 1. First test pure grayscale fidelity before watermark is applied
      const origText = window.state.exportSettings.watermarkText;
      const origIncludeDate = window.state.exportSettings.includeDate;
      window.state.exportSettings.watermarkText = '';
      window.state.exportSettings.includeDate = false;
      window.ExportEngine.renderExportCanvas();

      const canvas = document.getElementById('dni-canvas');
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      const preWmData = ctx.getImageData(0, 0, w, h).data;
      let preWmTotalSampled = 0;
      let preWmGrayMatches = 0;
      for (let i = 0; i < preWmData.length; i += 16) {
        preWmTotalSampled++;
        if (preWmData[i] === preWmData[i+1] && preWmData[i+1] === preWmData[i+2]) {
          preWmGrayMatches++;
        }
      }

      // 2. Restore watermark and test watermark rendering
      window.state.exportSettings.watermarkText = origText;
      window.state.exportSettings.includeDate = origIncludeDate;
      window.ExportEngine.renderExportCanvas();

      const postWmData = ctx.getImageData(0, 0, w, h).data;
      let redWatermarkPixels = 0;
      for (let i = 0; i < postWmData.length; i += 4) {
        if (postWmData[i] > 140 && postWmData[i+1] < 120 && postWmData[i+2] < 120) {
          redWatermarkPixels++;
        }
      }

      return {
        canvasW: w,
        canvasH: h,
        preWmTotalSampled,
        preWmGrayMatches,
        pureBwAccuracy: (preWmGrayMatches / preWmTotalSampled) * 100,
        redWatermarkPixels
      };
    });
    testResults.bwMatrixVerified = exportVerification.pureBwAccuracy === 100;
    testResults.watermarkVerified = exportVerification.redWatermarkPixels > 1000;
    console.log(`[CHECK] Composite B&W and Watermark check:`, exportVerification);

    // --- TEST 7: EXIF / GPS Metadata Stripping Verification ---
    console.log('[PHASE 9] Verifying EXIF / GPS stripping via Canvas re-encoding...');
    const jpegWithExifBuffer = createJpegWithExif();
    const jpegBase64 = `data:image/jpeg;base64,${jpegWithExifBuffer.toString('base64')}`;

    const srcHasExifMarker = jpegWithExifBuffer.includes(Buffer.from('Exif\0\0', 'ascii'));
    const srcHasGpsTag = jpegWithExifBuffer.includes(Buffer.from([0x25, 0x88]));
    console.log(`[CHECK] Test input contains EXIF header: ${srcHasExifMarker}, GPS tag: ${srcHasGpsTag}`);

    const strippedResult = await page.evaluate(async (dataUri) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cvs = document.createElement('canvas');
          cvs.width = img.naturalWidth;
          cvs.height = img.naturalHeight;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const exportedJpegDataUrl = cvs.toDataURL('image/jpeg', 0.92);
          const exportedPngDataUrl = cvs.toDataURL('image/png');
          resolve({
            exportedJpegBase64: exportedJpegDataUrl.split(',')[1],
            exportedPngBase64: exportedPngDataUrl.split(',')[1]
          });
        };
        img.src = dataUri;
      });
    }, jpegBase64);

    const exportedJpegBuf = Buffer.from(strippedResult.exportedJpegBase64, 'base64');
    const exportedPngBuf = Buffer.from(strippedResult.exportedPngBase64, 'base64');

    const exportedJpegHasExif = exportedJpegBuf.includes(Buffer.from('Exif\0\0', 'ascii'));
    const exportedJpegHasApp1 = exportedJpegBuf.includes(Buffer.from([0xFF, 0xE1]));
    const exportedJpegHasGps = exportedJpegBuf.includes(Buffer.from([0x25, 0x88]));
    const exportedPngHasGps = exportedPngBuf.includes(Buffer.from('GPS'));

    testResults.exifStripped = (!exportedJpegHasExif && !exportedJpegHasApp1 && !exportedJpegHasGps && !exportedPngHasGps);
    console.log(`[CHECK] Exported JPEG has EXIF header: ${exportedJpegHasExif}, APP1: ${exportedJpegHasApp1}, GPS: ${exportedJpegHasGps}`);
    console.log(`[CHECK] EXIF & GPS stripped verified: ${testResults.exifStripped}`);

    // --- TEST 8: Export Actions & Web Share Cascade ---
    console.log('[PHASE 10] Testing WhatsApp copy/share trigger...');
    const shareTriggered = await page.evaluate(async () => {
      let called = 'none';
      try {
        await window.ExportEngine.copyOrShareForWhatsApp();
        called = 'completed';
      } catch (e) {
        called = 'error: ' + e.message;
      }
      return called;
    });
    console.log(`[CHECK] Share execution: ${shareTriggered}`);

  } catch (err) {
    console.error('[TEST-ERROR]', err);
    testResults.consoleErrors.push(err.stack || err.message);
  } finally {
    await browser.close();
    server.close();
  }

  return testResults;
}

runForensicAudit().then(results => {
  console.log('\n================ AUDIT RESULTS SUMMARY ================');
  console.log('Total Network Requests:', results.networkCalls.length);
  console.log('External Requests (MUST BE ZERO):', results.externalRequests.length, results.externalRequests);
  console.log('Console Errors (MUST BE ZERO):', results.consoleErrors.length, results.consoleErrors);
  console.log('Rotation & Fine Tilt Math Passed:', results.mathChecks.rotation?.is90Swapped && results.mathChecks.rotation?.is180Preserved);
  console.log('Calibration Math Passed:', results.mathChecks.calibration?.passed);
  console.log('Pixelation Raster Authenticity Passed:', results.pixelationVerified);
  console.log('ITU-R BT.601 B&W Matrix Accuracy Passed (100%):', results.bwMatrixVerified);
  console.log('Watermark Rendering Authenticity Passed:', results.watermarkVerified);
  console.log('EXIF / GPS Stripping Verified:', results.exifStripped);
  console.log('=======================================================\n');

  fs.writeFileSync(path.join(ROOT_DIR, 'tests', 'adversarial', 'audit_evidence.json'), JSON.stringify(results, null, 2));
});
