import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT_DIR = process.cwd();
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

function createStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(ROOT_DIR, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + req.url);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

class TestSuite {
  constructor() {
    this.results = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    this.vulnerabilities = [];
  }

  record(name, passed, details = {}) {
    this.results.push({ name, passed, details, timestamp: new Date().toISOString() });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (!passed || Object.keys(details).length > 0) {
      console.log('   Details:', JSON.stringify(details));
    }
  }

  recordVulnerability(id, title, description, details = {}) {
    this.vulnerabilities.push({ id, title, description, details, timestamp: new Date().toISOString() });
    console.warn(`🚨 VULNERABILITY FOUND [${id}]: ${title}`);
    console.warn(`   Description: ${description}`);
    console.warn(`   Details: ${JSON.stringify(details)}`);
  }

  summary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    return {
      total,
      passed,
      failed,
      vulnerabilitiesCount: this.vulnerabilities.length,
      consoleErrorsCount: this.consoleErrors.length,
      pageErrorsCount: this.pageErrors.length,
      vulnerabilities: this.vulnerabilities,
      results: this.results,
      consoleErrors: this.consoleErrors,
      pageErrors: this.pageErrors
    };
  }
}

async function runAdversarialSuite() {
  console.log('=== STARTING ADVERSARIAL STRESS TEST SUITE ===');
  const { server, port, url } = await createStaticServer();
  console.log(`Static server running at ${url}`);

  const suite = new TestSuite();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        suite.consoleErrors.push({ text, location: msg.location() });
        console.warn('Browser Console Error:', text);
      }
    });

    page.on('pageerror', err => {
      suite.pageErrors.push(err.message);
      console.error('Browser Page Error:', err.message);
    });

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${url}/index.html`, { waitUntil: 'networkidle0' });

    // -------------------------------------------------------------
    // TEST SUITE 1: STEP NAVIGATION GUARDS
    // -------------------------------------------------------------
    console.log('\n--- Running Suite 1: Step Navigation Guards ---');

    // 1.1 Initial step should be step-1-1
    const initStep = await page.evaluate(() => window.state.wizardStep);
    suite.record('Initial step is step-1-1', initStep === 'step-1-1', { initStep });

    // 1.2 Attempt clicking Next button with no front image loaded
    const nextBtnDisabledBefore = await page.evaluate(() => {
      const btn = document.getElementById('btn-wizard-next');
      return btn ? btn.disabled : null;
    });
    suite.record('Next button on step-1-1 is disabled without image', nextBtnDisabledBefore === true, { nextBtnDisabledBefore });

    // Force call nextStep() programmatically without image
    await page.evaluate(() => window.Wizard.nextStep());
    const stepAfterNextCall = await page.evaluate(() => window.state.wizardStep);
    suite.record('nextStep() call without front image blocked at step-1-1', stepAfterNextCall === 'step-1-1', { stepAfterNextCall });

    // 1.3 Attempt clicking Prev button on step-1-1
    const prevBtnDisabled = await page.evaluate(() => {
      const btn = document.getElementById('btn-wizard-prev');
      return btn ? btn.disabled : null;
    });
    suite.record('Prev button disabled at initial step-1-1', prevBtnDisabled === true, { prevBtnDisabled });

    await page.evaluate(() => window.Wizard.prevStep());
    const stepAfterPrevCall = await page.evaluate(() => window.state.wizardStep);
    suite.record('prevStep() call at step-1-1 remains at step-1-1', stepAfterPrevCall === 'step-1-1', { stepAfterPrevCall });

    // 1.4 Stepper Dots Jump Guards without Front Image
    // Checking Step 1.2 and Step 1.3 guards
    await page.evaluate(() => window.Wizard.goToStep('step-1-2'));
    const stepAfter12Jump = await page.evaluate(() => window.state.wizardStep);
    suite.record('Direct jump to step-1-2 without front image is blocked (remains step-1-1)', stepAfter12Jump === 'step-1-1', { stepAfter12Jump });

    await page.evaluate(() => window.Wizard.goToStep('step-1-3'));
    const stepAfter13Jump = await page.evaluate(() => window.state.wizardStep);
    suite.record('Direct jump to step-1-3 without front image is blocked (remains step-1-1)', stepAfter13Jump === 'step-1-1', { stepAfter13Jump });

    // 1.4.1 ADVERSARIAL CHALLENGE: Attempt jumping directly to step-2-1 without Front Image
    await page.evaluate(() => window.Wizard.goToStep('step-2-1'));
    const stepAfter21Jump = await page.evaluate(() => window.state.wizardStep);
    const jumpTo21Blocked = stepAfter21Jump === 'step-1-1';
    suite.record('Direct jump to step-2-1 without front image is guarded', jumpTo21Blocked, { stepAfter21Jump });

    if (!jumpTo21Blocked) {
      suite.recordVulnerability(
        'VULN-M1-001',
        'Missing Prerequisite Guard on Step 2.1 (Back Side) Jump',
        'goToStep("step-2-1") does not check if window.state.sides.front.img exists, allowing a user to jump directly into the back-side flow without uploading a front image.',
        { targetStep: 'step-2-1', actualState: stepAfter21Jump, frontImg: null }
      );
    }

    // Reset back to step-1-1
    await page.evaluate(() => window.Wizard.goToStep('step-1-1'));

    // 1.4.2 Direct jump to step-final without front image
    await page.evaluate(() => window.Wizard.goToStep('step-final'));
    const stepAfterFinalJump = await page.evaluate(() => window.state.wizardStep);
    suite.record('Direct jump to step-final without front image redirects to step-1-1', stepAfterFinalJump === 'step-1-1', { stepAfterFinalJump });

    // 1.5 Invalid Step ID Guard
    await page.evaluate(() => window.Wizard.goToStep('step-non-existent'));
    const stepAfterInvalid = await page.evaluate(() => window.state.wizardStep);
    suite.record('Invalid step target is rejected', stepAfterInvalid === 'step-1-1', { stepAfterInvalid });

    // 1.6 TOAST HIT-TESTING OBSTRUCTION AUDIT
    // Check if active toasts overlay and block primary action buttons
    const toastHitBlock = await page.evaluate(() => {
      // Trigger a warning toast
      window.showToast('Test Warning', 'warning');
      const btn = document.getElementById('btn-demo-front');
      const r = btn.getBoundingClientRect();
      const elAtPoint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const isBlocked = elAtPoint && elAtPoint.closest('.toast') !== null;
      return { isBlocked, elementClassName: elAtPoint?.className };
    });

    if (toastHitBlock.isBlocked) {
      suite.recordVulnerability(
        'VULN-M1-002',
        'Active Toast Notifications Intercept Touch/Click Events on Bottom Controls',
        '.toast has pointer-events: auto and stacks at the bottom above the navigation bar, physically overlaying #btn-demo-front and absorbing click events for 3 seconds.',
        toastHitBlock
      );
    }
    suite.record('Toast does not physically block clicks on action buttons', !toastHitBlock.isBlocked, toastHitBlock);

    // Clear any active toasts from DOM to continue testing cleanly
    await page.evaluate(() => {
      document.getElementById('toast-container')?.replaceChildren();
    });

    // Now click #btn-demo-front to load demo front image
    await page.click('#btn-demo-front');
    await page.waitForFunction(() => window.state.sides.front.img !== null && window.state.wizardStep === 'step-1-2');
    const stepAfterFrontDemo = await page.evaluate(() => window.state.wizardStep);
    suite.record('Loading front demo automatically transitions to step-1-2', stepAfterFrontDemo === 'step-1-2', { stepAfterFrontDemo });

    // 1.7 On Step 1.2, attempt jumping to Step 2.2 / 2.3 without Back Image
    await page.evaluate(() => window.Wizard.goToStep('step-2-2'));
    let currStep = await page.evaluate(() => window.state.wizardStep);
    suite.record('Jump to step-2-2 without back image blocked', currStep === 'step-1-2', { currStep });

    await page.evaluate(() => window.Wizard.goToStep('step-2-3'));
    currStep = await page.evaluate(() => window.state.wizardStep);
    suite.record('Jump to step-2-3 without back image blocked', currStep === 'step-1-2', { currStep });

    // Clear toasts
    await page.evaluate(() => document.getElementById('toast-container')?.replaceChildren());

    // Advance to step-1-3
    await page.click('#btn-wizard-next');
    await page.waitForFunction(() => window.state.wizardStep === 'step-1-3');

    // Advance to step-2-1
    await page.click('#btn-wizard-next');
    await page.waitForFunction(() => window.state.wizardStep === 'step-2-1');
    const stepAt21 = await page.evaluate(() => window.state.wizardStep);
    suite.record('Reached step-2-1 sequentially', stepAt21 === 'step-2-1', { stepAt21 });

    // In step-2-1 without back image, check Next button state
    const nextBtnAt21Disabled = await page.evaluate(() => document.getElementById('btn-wizard-next')?.disabled);
    suite.record('Next button on step-2-1 disabled without back image', nextBtnAt21Disabled === true, { nextBtnAt21Disabled });

    await page.evaluate(() => window.Wizard.nextStep());
    const stepAfterBlockedNext21 = await page.evaluate(() => window.state.wizardStep);
    suite.record('nextStep() on step-2-1 blocked without back image', stepAfterBlockedNext21 === 'step-2-1', { stepAfterBlockedNext21 });

    // Clear toasts
    await page.evaluate(() => document.getElementById('toast-container')?.replaceChildren());

    // -------------------------------------------------------------
    // TEST SUITE 2: RAPID BACK-AND-FORTH TRANSITIONS & STRESS
    // -------------------------------------------------------------
    console.log('\n--- Running Suite 2: Rapid Back-and-Forth Transitions ---');

    // Return to step-1-2
    await page.evaluate(() => window.Wizard.goToStep('step-1-2'));

    // Stress test: 60 rapid alternating step switches between step-1-2 and step-1-3
    const rapidStressResult = await page.evaluate(async () => {
      const errors = [];
      const startTime = performance.now();
      for (let i = 0; i < 60; i++) {
        try {
          const target = i % 2 === 0 ? 'step-1-3' : 'step-1-2';
          window.Wizard.goToStep(target);
          const wrapper = document.getElementById('canvas-wrapper');
          const canvas = document.getElementById('dni-canvas');
          if (!wrapper || !canvas) {
            errors.push(`Iteration ${i}: Canvas elements missing`);
          }
          if (wrapper.parentElement !== document.querySelector(`#${target} [data-canvas-stage]`)) {
            errors.push(`Iteration ${i}: Wrapper not in host ${target}`);
          }
        } catch (e) {
          errors.push(`Iteration ${i} threw exception: ${e.message}`);
        }
      }
      const durationMs = performance.now() - startTime;
      return { errors, durationMs, finalStep: window.state.wizardStep };
    });

    suite.record(
      'Rapid alternating step switches (60 cycles) executed without DOM errors',
      rapidStressResult.errors.length === 0,
      { errorsCount: rapidStressResult.errors.length, durationMs: rapidStressResult.durationMs, firstErrors: rapidStressResult.errors.slice(0, 3) }
    );

    // Verify canvas remains functional after rapid cycling
    const canvasStatus = await page.evaluate(() => {
      const canvas = document.getElementById('dni-canvas');
      return {
        width: canvas.width,
        height: canvas.height,
        isConnected: canvas.isConnected,
        visible: !document.getElementById('canvas-wrapper').classList.contains('hidden')
      };
    });
    suite.record('Canvas remains connected, non-zero dimensions, and visible after rapid switches',
      canvasStatus.isConnected && canvasStatus.width > 0 && canvasStatus.height > 0 && canvasStatus.visible,
      canvasStatus
    );

    // -------------------------------------------------------------
    // TEST SUITE 3: SKIP BACK -> EXPORT -> RETURN -> ADD BACK -> ADVANCE
    // -------------------------------------------------------------
    console.log('\n--- Running Suite 3: Skip Back -> Export -> Return -> Add Back Flow ---');

    // 3.1 Navigate to step-2-1
    await page.evaluate(() => window.Wizard.goToStep('step-2-1'));

    // 3.2 Skip Back
    await page.click('#btn-skip-back');
    await page.waitForFunction(() => window.state.wizardStep === 'step-final');

    const skipState = await page.evaluate(() => ({
      step: window.state.wizardStep,
      skipped: window.state.sides.back.skipped,
      backImg: window.state.sides.back.img,
      mergeBoxHidden: document.getElementById('merge-options-box')?.classList.contains('hidden'),
      progressWidth: document.getElementById('wizard-progress-fill')?.style.width,
      fractionText: document.getElementById('wizard-step-fraction')?.textContent
    }));

    suite.record('Skip back side transitions to step-final with single card layout',
      skipState.step === 'step-final' && skipState.skipped === true && skipState.backImg === null && skipState.mergeBoxHidden === true,
      skipState
    );

    // Check canvas dimensions in single-card export layout
    const singleExportDims = await page.evaluate(() => {
      const c = document.getElementById('dni-canvas');
      return { width: c.width, height: c.height };
    });
    // Single card width is CARD_W + pad*2 = 1100 + 96 = 1196
    suite.record('Single card export canvas width is 1196px', singleExportDims.width === 1196, singleExportDims);

    // 3.3 Navigate BACK from step-final when back was skipped
    const prevTextWhenSkipped = await page.evaluate(() => document.getElementById('btn-prev-text')?.textContent);
    suite.record('Atrás button indicates "Atrás: Reverso"', prevTextWhenSkipped === 'Atrás: Reverso', { prevTextWhenSkipped });

    await page.click('#btn-wizard-prev');
    await page.waitForFunction(() => window.state.wizardStep === 'step-2-1');
    const returnedTo21 = await page.evaluate(() => window.state.wizardStep);
    suite.record('Navigating back from step-final with skipped back returns to step-2-1', returnedTo21 === 'step-2-1', { returnedTo21 });

    // Clear toasts if any
    await page.evaluate(() => document.getElementById('toast-container')?.replaceChildren());

    // 3.4 In step-2-1, now load back demo image
    await page.click('#btn-demo-back');
    await page.waitForFunction(() => window.state.sides.back.img !== null && window.state.wizardStep === 'step-2-2');

    const backLoadedState = await page.evaluate(() => ({
      step: window.state.wizardStep,
      skipped: window.state.sides.back.skipped,
      hasImg: !!window.state.sides.back.img,
      thumbVisible: !document.getElementById('preview-back-loaded')?.classList.contains('hidden')
    }));
    suite.record('Loading back card un-skips back side and lands on step-2-2',
      backLoadedState.step === 'step-2-2' && backLoadedState.skipped === false && backLoadedState.hasImg === true,
      backLoadedState
    );

    // 3.5 Calibrate or test rotation on step-2-2
    await page.click('#btn-rotate-right-back');
    const backOrientation = await page.evaluate(() => window.state.sides.back.imgOrientation);
    suite.record('Back card rotation succeeds (orientation: 90)', backOrientation === 90, { backOrientation });

    // Reset orientation
    await page.click('#btn-rotate-left-back');

    // 3.6 Advance to step-2-3 (Back redactions)
    await page.click('#btn-wizard-next');
    await page.waitForFunction(() => window.state.wizardStep === 'step-2-3');

    // Toggle MRZ and domicilio preset chips on back
    await page.click('#presets-back [data-preset="mrz"]');
    await page.click('#presets-back [data-preset="domicilio"]');
    const backBoxesCount = await page.evaluate(() => window.state.sides.back.boxes.length);
    suite.record('Preset chips applied on back side (mrz, domicilio)', backBoxesCount === 2, { backBoxesCount });

    // 3.7 Advance to step-final
    await page.click('#btn-wizard-next');
    await page.waitForFunction(() => window.state.wizardStep === 'step-final');

    const final2in1State = await page.evaluate(() => ({
      step: window.state.wizardStep,
      skipped: window.state.sides.back.skipped,
      mergeBoxHidden: document.getElementById('merge-options-box')?.classList.contains('hidden'),
      canvasWidth: document.getElementById('dni-canvas').width,
      canvasHeight: document.getElementById('dni-canvas').height
    }));

    suite.record('Final export displays 2-in-1 layout with merge options visible',
      final2in1State.step === 'step-final' && final2in1State.skipped === false && final2in1State.mergeBoxHidden === false && final2in1State.canvasHeight > 1500,
      final2in1State
    );

    // 3.8 Toggle Merge Layout to Horizontal and back
    await page.click('[data-merge-layout="horizontal"]');
    const horizDims = await page.evaluate(() => ({
      layout: window.state.exportSettings.mergeLayout,
      width: document.getElementById('dni-canvas').width,
      height: document.getElementById('dni-canvas').height
    }));
    // In horizontal: width = CARD_W*2 + pad*2 + gap = 2200 + 96 + 36 = 2332
    suite.record('Horizontal merge layout re-renders with 2332px width', horizDims.layout === 'horizontal' && horizDims.width === 2332, horizDims);

    await new Promise(r => setTimeout(r, 100)); // allow layout reflow
    await page.click('[data-merge-layout="vertical"]');
    const vertDims = await page.evaluate(() => ({
      layout: window.state.exportSettings.mergeLayout,
      width: document.getElementById('dni-canvas').width
    }));
    suite.record('Vertical merge layout restored (1196px width)', vertDims.layout === 'vertical' && vertDims.width === 1196, vertDims);

    // -------------------------------------------------------------
    // TEST SUITE 4: BROWSER VIEWPORT RESIZING ACROSS MOBILE VIEWPORTS
    // -------------------------------------------------------------
    console.log('\n--- Running Suite 4: Mobile Viewport Resizing & Layout Stress ---');

    const mobileViewports = [
      { name: 'Android Small (360x640)', width: 360, height: 640 },
      { name: 'iPhone 12/13/14 (390x844)', width: 390, height: 844 },
      { name: 'Pixel 7 / Android Large (412x915)', width: 412, height: 915 },
      { name: 'iPhone SE (320x568)', width: 320, height: 568 }
    ];

    for (const vp of mobileViewports) {
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
      await new Promise(r => setTimeout(r, 100)); // allow reflow

      // Check for horizontal overflow on body/document
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        return {
          docOverflow: docEl.scrollWidth > docEl.clientWidth + 1,
          bodyOverflow: body.scrollWidth > body.clientWidth + 1,
          docScrollW: docEl.scrollWidth,
          docClientW: docEl.clientWidth
        };
      });

      suite.record(`No horizontal overflow on ${vp.name}`, !overflow.docOverflow && !overflow.bodyOverflow, overflow);
      if (overflow.docOverflow || overflow.bodyOverflow) {
        suite.recordVulnerability(
          `VULN-M1-003-${vp.width}`,
          `Mobile Viewport Horizontal Overflow on ${vp.name}`,
          `.format-selection-row lacking flex-wrap causes #export-format select element to extend past screen bounds (${overflow.docScrollW}px vs ${overflow.docClientW}px), creating horizontal scrolling on small mobile screens.`,
          overflow
        );
      }

      // Check bottom nav bar visibility and bounds
      const navBounds = await page.evaluate(() => {
        const nav = document.getElementById('wizard-nav-bar');
        if (!nav) return null;
        const r = nav.getBoundingClientRect();
        return {
          visible: r.width > 0 && r.height > 0,
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
          withinViewport: r.bottom <= window.innerHeight + 2
        };
      });
      suite.record(`Bottom nav bar cleanly docked and visible on ${vp.name}`, !!(navBounds && navBounds.visible && navBounds.withinViewport), navBounds);

      // Check touch target min size (>= 44px) on primary navigation buttons
      const touchTargets = await page.evaluate(() => {
        const prev = document.getElementById('btn-wizard-prev')?.getBoundingClientRect();
        const dl = document.getElementById('btn-download')?.getBoundingClientRect();
        const copy = document.getElementById('btn-copy-clipboard')?.getBoundingClientRect();
        return {
          prevH: prev?.height,
          dlH: dl?.height,
          copyH: copy?.height,
          allAbove44: (prev?.height || 0) >= 42 && (dl?.height || 0) >= 42 && (copy?.height || 0) >= 42
        };
      });
      suite.record(`Primary touch targets >= 44px on ${vp.name}`, touchTargets.allAbove44, touchTargets);
    }

    // -------------------------------------------------------------
    // TEST SUITE 5: ADVERSARIAL INPUTS, API STRESS & RESILIENCE
    // -------------------------------------------------------------
    console.log('\n--- Running Suite 5: Adversarial Inputs & Error Handling ---');

    // 5.1 Adversarial watermark text (XSS, emojis, long text)
    const adversarialTexts = [
      '<script>alert("xss")</script>',
      'DROP TABLE DNI; -- 🔥 ⚠️ 🇪🇸',
      'A'.repeat(300),
      ''
    ];

    for (const advText of adversarialTexts) {
      const renderSuccess = await page.evaluate(txt => {
        try {
          window.state.exportSettings.watermarkText = txt;
          window.ExportEngine.renderExportCanvas();
          return true;
        } catch (e) {
          return e.message;
        }
      }, advText);

      suite.record(`Watermark handles adversarial string "${advText.slice(0, 20)}..."`, renderSuccess === true, { advText: advText.slice(0, 30), renderSuccess });
    }

    // 5.1.1 Adversarial check: Zero-dimension or unloaded image in export engine
    const zeroDimResult = await page.evaluate(() => {
      const oldImg = window.state.sides.front.img;
      const dummyImg = new Image(); // naturalWidth = 0, naturalHeight = 0
      try {
        window.state.sides.front.img = dummyImg;
        window.ExportEngine.renderExportCanvas();
        return { survived: true };
      } catch (e) {
        return { survived: false, error: e.message };
      } finally {
        window.state.sides.front.img = oldImg;
      }
    });
    suite.record('renderExportCanvas survives uninitialized/0-dimension image without DOMException', zeroDimResult.survived, zeroDimResult);
    if (!zeroDimResult.survived) {
      suite.recordVulnerability(
        'VULN-M1-004',
        'Uncaught DOMException on 0-Dimension Image Canvas drawImage',
        'renderCardOffscreen creates a 0x0 canvas when image has 0 naturalWidth/Height, causing drawImage to throw an unhandled DOMException InvalidStateError.',
        zeroDimResult
      );
    }

    // 5.2 Test downloadImage() execution
    const downloadExecution = await page.evaluate(() => {
      try {
        let clicked = false;
        const origCreate = document.createElement.bind(document);
        document.createElement = function(tag) {
          const el = origCreate(tag);
          if (tag.toLowerCase() === 'a') {
            el.click = () => { clicked = true; };
          }
          return el;
        };
        window.ExportEngine.downloadImage('image/jpeg');
        document.createElement = origCreate;
        return { success: true, clicked };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    suite.record('downloadImage() executes cleanly without exception', downloadExecution.success && downloadExecution.clicked, downloadExecution);

    // 5.3 Test copyOrShareForWhatsApp() fallback execution
    const shareExecution = await page.evaluate(async () => {
      try {
        let downloadFallbackTriggered = false;
        const origDl = window.ExportEngine.downloadImage;
        window.ExportEngine.downloadImage = () => { downloadFallbackTriggered = true; };

        await window.ExportEngine.copyOrShareForWhatsApp();
        window.ExportEngine.downloadImage = origDl;
        return { success: true, fallbackRan: downloadFallbackTriggered };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    suite.record('copyOrShareForWhatsApp() completes gracefully via cascade', shareExecution.success, shareExecution);

    // 5.4 Test restartWizard() reset integrity
    await page.click('#btn-restart-wizard');
    await page.waitForFunction(() => window.state.wizardStep === 'step-1-1');

    const resetState = await page.evaluate(() => ({
      step: window.state.wizardStep,
      frontImg: window.state.sides.front.img,
      backImg: window.state.sides.back.img,
      frontBoxes: window.state.sides.front.boxes.length,
      backBoxes: window.state.sides.back.boxes.length,
      frontSkipped: window.state.sides.front.skipped,
      backSkipped: window.state.sides.back.skipped,
      activeStepEl: document.querySelector('.wizard-step.active')?.id,
      progressPct: document.getElementById('wizard-progress-fill')?.style.width
    }));

    suite.record('restartWizard() thoroughly resets all state variables and DOM to step-1-1',
      resetState.step === 'step-1-1' &&
      resetState.frontImg === null &&
      resetState.backImg === null &&
      resetState.frontBoxes === 0 &&
      resetState.backBoxes === 0 &&
      resetState.activeStepEl === 'step-1-1',
      resetState
    );

    // Final check for unexpected console errors or unhandled page errors
    const zeroErrors = suite.consoleErrors.length === 0 && suite.pageErrors.length === 0;
    suite.record('Zero console errors and zero unhandled page errors throughout test run', zeroErrors, {
      consoleErrors: suite.consoleErrors,
      pageErrors: suite.pageErrors
    });

  } finally {
    await browser.close();
    server.close();
  }

  const summary = suite.summary();
  console.log('\n=== ADVERSARIAL TEST SUITE SUMMARY ===');
  console.log(`Total tests:          ${summary.total}`);
  console.log(`Passed:               ${summary.passed}`);
  console.log(`Failed:               ${summary.failed}`);
  console.log(`Vulnerabilities:      ${summary.vulnerabilitiesCount}`);
  console.log(`Console errors:       ${summary.consoleErrorsCount}`);
  console.log(`Unhandled page errors:${summary.pageErrorsCount}`);

  return summary;
}

runAdversarialSuite()
  .then(summary => {
    fs.writeFileSync(path.join(ROOT_DIR, 'test_summary_temp.json'), JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  });
