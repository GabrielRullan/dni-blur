const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT_DIR = path.resolve(__dirname, '../../');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function diagnose() {
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';
    const filePath = path.join(ROOT_DIR, reqUrl);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  });

  await new Promise(r => server.listen(8889, r));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915 });
  await page.goto('http://localhost:8889/index.html');

  // Load demo front
  await page.click('#btn-demo-front');
  await page.waitForFunction(() => window.state.wizardStep === 'step-1-2');

  console.log('Step 1.2 reached');
  console.log('Initial orientation:', await page.evaluate(() => window.state.sides.front.imgOrientation));

  // Click 1
  await page.click('#btn-rotate-right');
  console.log('After click 1:', await page.evaluate(() => window.state.sides.front.imgOrientation));

  // Check button bounding box
  const box1 = await page.$eval('#btn-rotate-right', el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 };
  });
  console.log('Button box after click 1:', box1);

  // Click 2
  await page.click('#btn-rotate-right');
  console.log('After click 2:', await page.evaluate(() => window.state.sides.front.imgOrientation));

  // Click via evaluate
  await page.evaluate(() => document.getElementById('btn-rotate-right').click());
  console.log('After direct DOM click 3:', await page.evaluate(() => window.state.sides.front.imgOrientation));

  await browser.close();
  server.close();
}

diagnose().catch(console.error);
