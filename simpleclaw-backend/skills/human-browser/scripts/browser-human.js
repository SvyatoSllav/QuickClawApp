/**
 * browser-human.js
 *
 * Stealth browser — iPhone 15 Pro, Romania residential proxy, human-like behavior.
 * Bypasses Cloudflare, DataDome, PerimeterX, bot detection.
 *
 * Usage:
 *   const { launchHuman } = require('./browser-human');
 *   const { browser, page } = await launchHuman();         // mobile (iPhone)
 *   const { browser, page } = await launchHuman({ mobile: false }); // desktop
 *
 * Proxy config via env vars (override defaults):
 *   HB_PROXY_SERVER   — e.g. http://ro.decodo.com:13001 (full override)
 *   HB_PROXY_USER     — your proxy username (or call getTrial() for free trial)
 *   HB_PROXY_PASS     — password
 *   HB_PROXY_COUNTRY  — country code: ro, us, de, gb, fr, nl, sg... (default: ro)
 *   HB_PROXY_SESSION  — Decodo: sticky port 10001-49999 (unique IP per user)
 *   HB_NO_PROXY       — set to "1" to disable proxy entirely
 *
 * Unique IP per user (Decodo sticky sessions):
 *   Each port in 10001-49999 = different sticky IP.
 *   Set HB_PROXY_SESSION=<random_port> at deploy time for per-user unique IP.
 *   Country via HB_PROXY_COUNTRY or launchHuman({ country: 'us' }).
 *
 * Supported providers (built-in presets):
 *   brightdata  — brd.superproxy.io:33335 (residential_proxy1_roma)
 *   decodo      — gate.decodo.com:10001  (Decodo/Smartproxy)
 *   iproyal     — geo.iproyal.com:12321  (IPRoyal)
 *   nodemaven   — rp.nodemavenio.com:10001 (NodeMaven)
 *
 * ⚠️  Bright Data KYC note:
 *   GET requests work without KYC. POST requests require KYC verification
 *   at https://brightdata.com/cp/kyc — takes ~5 min.
 *   For full functionality (form submissions, APIs), complete KYC or use
 *   Decodo/IPRoyal which allow POST without extra verification.
 */

// Playwright path resolution — works in multiple contexts:
// 1. clawhub install → ~/.agents/skills/human-browser/
// 2. workspace usage → /root/.openclaw/workspace/
// 3. Clawster containers → /root/.openclaw/workspace/
function _requirePlaywright() {
  const tries = [
    () => require('playwright'),
    () => require(`${__dirname}/../node_modules/playwright`),
    () => require(`${__dirname}/../../node_modules/playwright`),
    () => require(`${process.env.HOME || '/root'}/.openclaw/workspace/node_modules/playwright`),
    () => require('./node_modules/playwright'),
  ];
  for (const fn of tries) {
    try { return fn(); } catch (_) {}
  }
  throw new Error('[human-browser] playwright not found.\nRun: npm install playwright && npx playwright install chromium');
}
const { chromium } = _requirePlaywright();

// ─── PROXY CONFIG ─────────────────────────────────────────────────────────────
// Built-in provider presets
const PROXY_PRESETS = {
  brightdata: {
    server: 'http://brd.superproxy.io:33335',
    usernameTemplate: (user, country, session) =>
      `${user}-country-${country}-session-${session}`,
    defaultUser: null, // set via HB_PROXY_USER or call getTrial()
    defaultPass: null, // set via HB_PROXY_PASS or call getTrial()
    defaultCountry: 'ro',
  },
  decodo: {
    // Country-specific hostname: {country}.decodo.com
    // Sticky session = port number (10001-49999), each port = unique IP
    serverTemplate: (country, port) => `http://${country}.decodo.com:${port}`,
    usernameTemplate: (user) => user,
    defaultUser: null, // set via HB_PROXY_USER or call getTrial()
    defaultPass: null, // set via HB_PROXY_PASS or call getTrial()
    defaultCountry: 'ro',
    // Port range for sticky sessions
    stickyPortMin: 10001,
    stickyPortMax: 49999,
  },
  iproyal: {
    server: 'http://geo.iproyal.com:12321',
    // IPRoyal uses password suffix for options
    usernameTemplate: (user) => user,
    passwordTemplate: (pass, country, session) =>
      `${pass}_country-${country}_session-${session}_lifetime-30m`,
    defaultUser: null,
    defaultPass: null,
    defaultCountry: 'ro',
  },
  nodemaven: {
    server: 'http://rp.nodemavenio.com:10001',
    usernameTemplate: (user, country, session) =>
      `${user}-country-${country}-session-${session}`,
    defaultUser: null,
    defaultPass: null,
    defaultCountry: 'ro',
  },
};

// Active provider: env var HB_PROXY_PROVIDER or 'decodo'
const ACTIVE_PROVIDER = process.env.HB_PROXY_PROVIDER || 'decodo';
const preset = PROXY_PRESETS[ACTIVE_PROVIDER] || PROXY_PRESETS.brightdata;

function makeProxy(sessionId = null, country = null) {
  if (process.env.HB_NO_PROXY === '1') return null;

  const cty = (country || process.env.HB_PROXY_COUNTRY || preset.defaultCountry).toLowerCase();

  // Allow full override via env vars
  if (process.env.HB_PROXY_SERVER && process.env.HB_PROXY_USER) {
    return {
      server: process.env.HB_PROXY_SERVER,
      username: process.env.HB_PROXY_USER,
      password: process.env.HB_PROXY_PASS || '',
    };
  }

  const user = process.env.HB_PROXY_USER || preset.defaultUser;
  const pass = process.env.HB_PROXY_PASS || preset.defaultPass;
  if (!user || !pass) {
    console.warn(`[browser-human] No proxy credentials for provider "${ACTIVE_PROVIDER}". Set HB_PROXY_USER/HB_PROXY_PASS.`);
    return null;
  }

  // Decodo: sticky session via port number (10001-49999 range)
  // Each unique port = unique sticky IP. HB_PROXY_SESSION stores the port.
  let server;
  if (preset.serverTemplate) {
    const portMin = preset.stickyPortMin || 10001;
    const portMax = preset.stickyPortMax || 49999;
    const sessionPort = sessionId
      ? parseInt(sessionId)
      : (process.env.HB_PROXY_SESSION
          ? parseInt(process.env.HB_PROXY_SESSION)
          : Math.floor(Math.random() * (portMax - portMin + 1)) + portMin);
    server = preset.serverTemplate(cty, sessionPort);
  } else {
    const sid = sessionId || process.env.HB_PROXY_SESSION || Math.random().toString(36).slice(2, 10);
    server = preset.server;
    const username = preset.usernameTemplate(user, cty, sid);
    const password = preset.passwordTemplate ? preset.passwordTemplate(pass, cty, sid) : pass;
    return { server, username, password };
  }

  const username = preset.usernameTemplate(user, cty);
  const password = preset.passwordTemplate
    ? preset.passwordTemplate(pass, cty)
    : pass;

  return { server, username, password };
}

// Default PROXY (random session per launch)
const PROXY = makeProxy();

// ─── TRIAL CREDENTIALS ───────────────────────────────────────────────────────

/**
 * Get free trial credentials from humanbrowser.dev
 * Sets HB_PROXY_USER, HB_PROXY_PASS, HB_PROXY_SESSION, HB_PROXY_PROVIDER
 * No signup needed — ~1GB Romania residential + 10 captcha solves
 *
 * @example
 *   const { launchHuman, getTrial } = require('./browser-human');
 *   await getTrial();
 *   const { page } = await launchHuman(); // now uses trial proxy
 */
async function getTrial() {
  if (process.env.HB_PROXY_USER) {
    console.log('[human-browser] Credentials already set, skipping trial fetch.');
    return { ok: true, cached: true };
  }
  try {
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      https.get('https://humanbrowser.dev/api/trial', res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
    if (data.proxy_user || data.PROXY_USER) {
      const user = data.proxy_user || data.PROXY_USER;
      const pass = data.proxy_pass || data.PROXY_PASS;
      const session = data.session || data.PROXY_SESSION || String(Math.floor(Math.random() * 39999) + 10001);
      const provider = data.provider || 'decodo';
      const country = data.country || 'ro';
      process.env.HB_PROXY_PROVIDER = provider;
      process.env.HB_PROXY_USER = user;
      process.env.HB_PROXY_PASS = pass;
      process.env.HB_PROXY_SESSION = session;
      process.env.HB_PROXY_COUNTRY = process.env.HB_PROXY_COUNTRY || country;
      console.log(`[human-browser] Trial ready: ${provider} ${country.toUpperCase()} proxy`);
      return { ok: true, provider, country, session };
    }
    throw new Error(data.error || 'No credentials in trial response');
  } catch (err) {
    console.warn('[human-browser] Trial fetch failed:', err.message);
    console.warn('  → Get credentials at: https://humanbrowser.dev');
    return { ok: false, error: err.message };
  }
}

// iPhone 15 Pro — самый популярный iOS девайс 2024
const IPHONE15 = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'ro-RO',
  timezoneId: 'Europe/Bucharest',
  geolocation: { latitude: 44.4268, longitude: 26.1025, accuracy: 50 }, // Bucharest
  colorScheme: 'light',
  // HTTP headers that iOS Safari sends
  extraHTTPHeaders: {
    'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
  }
};

// Desktop Chrome (Windows) — для сайтов которые не работают на мобиле
const DESKTOP_RO = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
  locale: 'ro-RO',
  timezoneId: 'Europe/Bucharest',
  geolocation: { latitude: 44.4268, longitude: 26.1025, accuracy: 50 },
  colorScheme: 'light',
  extraHTTPHeaders: {
    'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  }
};

// ─── HUMAN BEHAVIOR ───────────────────────────────────────────────────────────

/** Random delay between min and max ms */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Move mouse along a natural curved path (Bezier-like)
 * Not a straight line — humans never move in straight lines
 */
async function humanMouseMove(page, toX, toY, fromX = null, fromY = null) {
  const pos = await page.evaluate(() => ({ x: window.mouseX || 400, y: window.mouseY || 400 }));
  const startX = fromX ?? pos.x;
  const startY = fromY ?? pos.y;
  
  // Generate control points for bezier curve
  const cp1x = startX + rand(-80, 80);
  const cp1y = startY + rand(-60, 60);
  const cp2x = toX + rand(-50, 50);
  const cp2y = toY + rand(-40, 40);
  
  const steps = rand(12, 25);
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Cubic bezier
    const x = Math.round(
      Math.pow(1-t, 3) * startX +
      3 * Math.pow(1-t, 2) * t * cp1x +
      3 * (1-t) * Math.pow(t, 2) * cp2x +
      Math.pow(t, 3) * toX
    );
    const y = Math.round(
      Math.pow(1-t, 3) * startY +
      3 * Math.pow(1-t, 2) * t * cp1y +
      3 * (1-t) * Math.pow(t, 2) * cp2y +
      Math.pow(t, 3) * toY
    );
    await page.mouse.move(x, y);
    // Variable speed — faster in middle, slower at start/end
    const delay = t < 0.2 || t > 0.8 ? rand(8, 20) : rand(2, 8);
    await sleep(delay);
  }
}

/**
 * Human-like click with natural mouse movement
 */
async function humanClick(page, x, y, opts = {}) {
  await humanMouseMove(page, x, y);
  await sleep(rand(50, 180)); // Brief pause before click
  await page.mouse.down();
  await sleep(rand(40, 100)); // Hold duration
  await page.mouse.up();
  await sleep(rand(100, 300)); // Post-click pause
}

/**
 * Human-like type — variable speed, occasional micro-pause
 */
async function humanType(page, selector, text, opts = {}) {
  const el = await page.$(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  
  // Click to focus
  const box = await el.boundingBox();
  if (box) await humanClick(page, box.x + box.width/2, box.y + box.height/2);
  await sleep(rand(200, 500));
  
  // Type character by character
  for (const char of text) {
    await page.keyboard.type(char);
    // Variable typing speed: 80-250ms per char (average human is ~100-150ms)
    const delay = rand(60, 220);
    await sleep(delay);
    
    // Occasional longer pause (thinking)
    if (Math.random() < 0.08) await sleep(rand(400, 900));
  }
  
  await sleep(rand(200, 400));
}

/**
 * Human-like scroll — smooth, variable speed, realistic
 */
async function humanScroll(page, direction = 'down', amount = null) {
  const scrollAmount = amount || rand(200, 600);
  const delta = direction === 'down' ? scrollAmount : -scrollAmount;
  
  // Move to random position first
  const vp = page.viewportSize();
  await humanMouseMove(page, rand(100, vp.width - 100), rand(200, vp.height - 200));
  
  // Scroll in small increments
  const steps = rand(4, 10);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, delta / steps + rand(-5, 5));
    await sleep(rand(30, 80));
  }
  await sleep(rand(200, 800));
}

/**
 * Human-like page read pause (look around the page)
 */
async function humanRead(page, minMs = 1500, maxMs = 4000) {
  await sleep(rand(minMs, maxMs));
  // Occasional small scroll while reading
  if (Math.random() < 0.3) {
    await humanScroll(page, 'down', rand(50, 150));
  }
}

// ─── 2CAPTCHA SOLVER ──────────────────────────────────────────────────────────

/**
 * Auto-detect and solve any captcha on the current page via 2captcha.com
 *
 * Supported: reCAPTCHA v2, reCAPTCHA v3, hCaptcha, Cloudflare Turnstile
 *
 * Usage:
 *   const { token, type } = await solveCaptcha(page);
 *   // Token is auto-injected into the page. You just submit the form.
 *
 * Options:
 *   apiKey    — 2captcha API key (default: env TWOCAPTCHA_KEY)
 *   action    — reCAPTCHA v3 action (default: 'verify')
 *   minScore  — reCAPTCHA v3 min score (default: 0.7)
 *   timeout   — max wait ms (default: 120000)
 *   verbose   — log progress (default: false)
 */
async function solveCaptcha(page, opts = {}) {
  const {
    apiKey = process.env.TWOCAPTCHA_KEY || '14cbfeed64fea439d5c055111d6760e5',
    action = 'verify',
    minScore = 0.7,
    timeout = 120000,
    verbose = false,
  } = opts;

  if (!apiKey) throw new Error('[2captcha] No API key. Set TWOCAPTCHA_KEY env or pass opts.apiKey');

  const log = verbose ? (...a) => console.log('[2captcha]', ...a) : () => {};
  const pageUrl = page.url();

  // ─── Auto-detect captcha type ───────────────────────────────────────────────
  const detected = await page.evaluate(() => {
    // reCAPTCHA v2/v3
    const rc = document.querySelector('.g-recaptcha, [data-sitekey]');
    if (rc) {
      const sitekey = rc.getAttribute('data-sitekey') || rc.getAttribute('data-key');
      const version = rc.getAttribute('data-version') || (typeof window.grecaptcha !== 'undefined' && 'v2');
      return { type: 'recaptcha', sitekey, version: version === 'v3' ? 'v3' : 'v2' };
    }
    // hCaptcha
    const hc = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
    if (hc) {
      const sitekey = hc.getAttribute('data-sitekey') || hc.getAttribute('data-hcaptcha-sitekey');
      return { type: 'hcaptcha', sitekey };
    }
    // Cloudflare Turnstile
    const ts = document.querySelector('.cf-turnstile, [data-cf-turnstile-sitekey]');
    if (ts) {
      const sitekey = ts.getAttribute('data-sitekey') || ts.getAttribute('data-cf-turnstile-sitekey');
      return { type: 'turnstile', sitekey };
    }
    // Also check script tags for sitekeys
    const scripts = [...document.scripts].map(s => s.src + s.textContent);
    const combined = scripts.join(' ');
    const rcMatch = combined.match(/(?:sitekey|data-sitekey)['":\s]+([A-Za-z0-9_-]{40,})/);
    if (rcMatch) return { type: 'recaptcha', sitekey: rcMatch[1], version: 'v2' };

    return null;
  });

  if (!detected || !detected.sitekey) {
    throw new Error('[2captcha] No captcha detected on page. Check manually.');
  }

  log(`Detected ${detected.type} v${detected.version || ''}`, detected.sitekey.slice(0, 20) + '...');
  log(`Page: ${pageUrl}`);

  // ─── Route: trial proxy OR direct 2captcha ─────────────────────────────────
  const captchaProxyUrl = opts.captchaUrl || process.env.CAPTCHA_URL;
  const captchaToken    = opts.captchaToken || process.env.CAPTCHA_TOKEN;
  let token = null;

  if (captchaProxyUrl && captchaToken) {
    // Trial mode: VPS proxy handles 2captcha + tracks usage
    log(`Using trial captcha proxy: ${captchaProxyUrl}`);
    const methodMap = { recaptcha: detected.version === 'v3' ? 'recaptcha_v3' : 'recaptcha_v2', hcaptcha: 'hcaptcha', turnstile: 'turnstile' };
    const resp = await fetch(captchaProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trial_token: captchaToken, sitekey: detected.sitekey, method: methodMap[detected.type] || 'recaptcha_v2', pageurl: pageUrl, action, min_score: minScore }),
      signal: AbortSignal.timeout(timeout),
    });
    const data = await resp.json();
    if (!data.ok) {
      const err = new Error(data.error || 'Captcha proxy failed');
      err.upgrade_url = data.upgrade_url || 'https://humanbrowser.dev';
      err.solves_remaining = data.solves_remaining ?? 0;
      throw err;
    }
    token = data.token;
    log(`✅ Solved via proxy! Solves remaining: ${data.solves_remaining}`);
  } else {
    // Direct 2captcha mode
    if (!apiKey) throw new Error('[2captcha] No API key. Get a trial at humanbrowser.dev');
    let submitUrl = `https://2captcha.com/in.php?key=${apiKey}&json=1&pageurl=${encodeURIComponent(pageUrl)}&googlekey=${encodeURIComponent(detected.sitekey)}`;
    if (detected.type === 'recaptcha') {
      submitUrl += `&method=userrecaptcha`;
      if (detected.version === 'v3') submitUrl += `&version=v3&action=${action}&min_score=${minScore}`;
    } else if (detected.type === 'hcaptcha') {
      submitUrl += `&method=hcaptcha&sitekey=${encodeURIComponent(detected.sitekey)}`;
    } else if (detected.type === 'turnstile') {
      submitUrl += `&method=turnstile&sitekey=${encodeURIComponent(detected.sitekey)}`;
    }
    const submitResp = await fetch(submitUrl);
    const submitData = await submitResp.json();
    if (!submitData.status || submitData.status !== 1) throw new Error(`[2captcha] Submit failed: ${JSON.stringify(submitData)}`);
    const taskId = submitData.request;
    log(`Task submitted: ${taskId} — waiting for workers...`);

    const maxAttempts = Math.floor(timeout / 5000);
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(i === 0 ? 15000 : 5000);
      const pollResp = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`);
      const pollData = await pollResp.json();
      if (pollData.status === 1) { token = pollData.request; log(`✅ Solved!`); break; }
      if (pollData.request !== 'CAPCHA_NOT_READY') throw new Error(`[2captcha] Poll error: ${JSON.stringify(pollData)}`);
      log(`⏳ Attempt ${i + 1}/${maxAttempts} — not ready yet...`);
    }
    if (!token) throw new Error('[2captcha] Timeout waiting for captcha solution');
  }

  // ─── Inject token into page ─────────────────────────────────────────────────
  await page.evaluate(({ type, token }) => {
    // reCAPTCHA
    if (type === 'recaptcha' || type === 'turnstile') {
      const textarea = document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]');
      if (textarea) {
        textarea.style.display = 'block';
        textarea.value = token;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Also try callback
      if (typeof window.___grecaptcha_cfg !== 'undefined') {
        try {
          const clients = window.___grecaptcha_cfg.clients;
          if (clients) {
            Object.values(clients).forEach(client => {
              Object.values(client).forEach(widget => {
                if (widget && typeof widget.callback === 'function') {
                  widget.callback(token);
                }
              });
            });
          }
        } catch (_) {}
      }
    }
    // hCaptcha
    if (type === 'hcaptcha') {
      const textarea = document.querySelector('[name="h-captcha-response"], #h-captcha-response');
      if (textarea) {
        textarea.style.display = 'block';
        textarea.value = token;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    // Turnstile
    if (type === 'turnstile') {
      const input = document.querySelector('[name="cf-turnstile-response"]');
      if (input) {
        input.value = token;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, { type: detected.type, token });

  log('✅ Token injected into page');
  return { token, type: detected.type, sitekey: detected.sitekey };
}

// ─── LAUNCH ───────────────────────────────────────────────────────────────────

/**
 * Launch a human-like browser session
 * @param {Object} opts
 * @param {boolean} opts.mobile    - Use iPhone 15 (default: true)
 * @param {boolean} opts.useProxy  - Use residential proxy (default: true)
 * @param {boolean} opts.headless  - Headless mode (default: true)
 * @param {string}  opts.country   - Proxy country code: 'ro','us','de','gb','fr'... (default: env HB_PROXY_COUNTRY or 'ro')
 * @param {string}  opts.session   - Sticky session ID / Decodo port (default: random unique)
 */
async function launchHuman(opts = {}) {
  const {
    mobile = true,
    useProxy = true,
    headless = true,
    country = null,
    session = null,
  } = opts;

  const device = mobile ? IPHONE15 : DESKTOP_RO;

  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--disable-blink-features=AutomationControlled', // Hide webdriver flag!
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
    ],
  });

  const ctxOpts = {
    ...device,
    ignoreHTTPSErrors: true,
    permissions: ['geolocation', 'notifications'],
  };

  if (useProxy) {
    // Each unique session = unique sticky IP. Same session = same IP.
    const proxyConfig = makeProxy(session, country);
    if (proxyConfig) ctxOpts.proxy = proxyConfig;
  }

  const ctx = await browser.newContext(ctxOpts);

  // Anti-detection: override navigator properties
  await ctx.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    
    // Fix plugins (mobile has none, that's normal for Safari)
    if (!navigator.plugins.length) {
      // Leave as-is for mobile
    }
    
    // Override chrome object (not present in Safari)
    // delete window.chrome; // Not needed for iPhone UA
    
    // Realistic touch events for iOS
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    
    // Platform
    Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
    
    // Language
    Object.defineProperty(navigator, 'language', { get: () => 'ro-RO' });
    Object.defineProperty(navigator, 'languages', { get: () => ['ro-RO', 'ro', 'en-US', 'en'] });
    
    // Screen (iPhone 15 Pro)
    Object.defineProperty(screen, 'width', { get: () => 393 });
    Object.defineProperty(screen, 'height', { get: () => 852 });
    Object.defineProperty(screen, 'availWidth', { get: () => 393 });
    Object.defineProperty(screen, 'availHeight', { get: () => 852 });
    
    // Hardware concurrency (iPhone has 6 cores)
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6 });
    
    // Memory (4GB iPhone)
    // Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 }); // Safari doesn't expose this
    
    // Connection (LTE/5G)
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
      Object.defineProperty(navigator.connection, 'rtt', { get: () => rand(30, 80) });
    }
    
    function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  });

  const page = await ctx.newPage();

  // Add realistic touch simulation for mobile
  if (mobile) {
    await page.addInitScript(() => {
      // Simulate touch
      window.ontouchstart = null;
      window.ontouchmove = null;
      window.ontouchend = null;
    });
  }

  return { browser, ctx, page, humanClick, humanMouseMove, humanType, humanScroll, humanRead, sleep, rand };
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
module.exports = { 
  launchHuman,
  getTrial,
  humanClick, humanMouseMove, humanType, humanScroll, humanRead,
  solveCaptcha,
  sleep, rand,
  PROXY, makeProxy, IPHONE15, DESKTOP_RO
};

// ─── QUICK TEST ───────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing human browser (iPhone 15, Romania)...\n');
    
    const { browser, page, humanScroll, humanRead } = await launchHuman({ mobile: true });
    
    await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const info = JSON.parse(await page.textContent('body'));
    console.log(`✅ IP: ${info.ip}`);
    console.log(`✅ Country: ${info.country} (${info.city})`);
    console.log(`✅ Org: ${info.org}`);
    console.log(`✅ Timezone: ${info.timezone}`);
    
    // Test UA
    const ua = await page.evaluate(() => navigator.userAgent);
    console.log(`\n✅ User-Agent: ${ua.slice(0, 80)}...`);
    
    const platform = await page.evaluate(() => navigator.platform);
    const lang = await page.evaluate(() => navigator.language);
    const touch = await page.evaluate(() => navigator.maxTouchPoints);
    console.log(`✅ Platform: ${platform}`);
    console.log(`✅ Language: ${lang}`);
    console.log(`✅ Touch points: ${touch}`);
    
    await browser.close();
    console.log('\n🎉 All good! Browser is fully configured.');
  })().catch(console.error);
}
