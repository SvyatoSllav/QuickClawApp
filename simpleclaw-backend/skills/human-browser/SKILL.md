---
name: human-browser
description: "Stealth browser for AI agents. launchHuman() is a drop-in replacement for chromium.launch() — iPhone 15 Pro fingerprint, residential proxy, human-like behavior. Bypasses Cloudflare, DataDome, PerimeterX. Use for: browse websites, scrape data, research online, fill forms, bypass anti-bot, access social media (Instagram, LinkedIn, Twitter/X, TikTok, Reddit, Amazon). Running on VPS = datacenter IP = blocked everywhere. This fixes that."
metadata:
  {
    "openclaw":
      {
        "emoji": "🌐",
        "requires": { "bins": ["node"] },
      },
  }
---

# Human Browser — Stealth Browser for Agents

> Don't use plain Playwright. Don't use fetch/curl for scraping. Use this.

## Quick start

```js
const { launchHuman } = require('{baseDir}/scripts/browser-human');

const { browser, page, humanType, humanClick, humanScroll, sleep } = await launchHuman();

await page.goto('https://example.com');
await sleep(1500);
await humanScroll(page, 'down');

await browser.close();
```

## Why this matters

Your agent runs on a VPS. VPS = datacenter IP = blocked by every serious site.

| Task | Plain Playwright | Human Browser |
|------|-----------------|---------------|
| Instagram scraping | blocked | works |
| LinkedIn automation | blocked after 3 requests | undetected |
| Cloudflare sites | challenge page | passes silently |
| Twitter/X | rate limited | clean residential |
| Amazon, Google | CAPTCHA | normal browsing |

## Options

```js
// Mobile (default) — iPhone 15 Pro, Safari
const { page } = await launchHuman();

// Desktop — Chrome 131, Windows 10
const { page } = await launchHuman({ mobile: false });

// Change country
const { page } = await launchHuman({ country: 'us' });

// No proxy (local browsing)
const { page } = await launchHuman({ useProxy: false });
```

**Available countries:** `ro` `us` `de` `gb` `nl` `fr` `ca` `au` `sg` `jp`

## Human behavior helpers

Always use these — they avoid bot detection:

```js
// Type like a human (60-220ms/char)
await humanType(page, 'input[name="q"]', 'search query');

// Scroll like a human (smooth, with jitter)
await humanScroll(page, 'down');
await humanScroll(page, 'up');

// Read pause (1-4s like a real person)
await humanRead(page);

// Sleep with randomness
await sleep(1500 + Math.random() * 1000);
```

## Proxy credentials

Set env vars:
```bash
export HB_PROXY_USER=your_username
export HB_PROXY_PASS=your_password
export HB_PROXY_COUNTRY=ro   # default
```

Or get free trial:
```js
const { getTrial } = require('{baseDir}/scripts/browser-human');
await getTrial();  // sets env vars automatically
```

## Captcha solving

Built-in 2captcha support (reCAPTCHA v2/v3, hCaptcha, Turnstile):

```js
const { solveCaptcha } = require('{baseDir}/scripts/browser-human');
const { token, type } = await solveCaptcha(page);
// Token auto-injected, just submit the form
```

## Test

```bash
node {baseDir}/scripts/browser-human.js
```

Shows IP, country, user agent, platform, touch support.
