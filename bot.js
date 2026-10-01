const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'http://localhost:20128/';
const ACCOUNT_FILE = path.join(__dirname, 'account.txt');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// --- Resilient selectors (href/text-based instead of brittle full CSS paths) ---

// 9Router navigation
const PROVIDER_SELECTOR = 'a[href="/dashboard/providers"]';
const ANTIGRAVITY_SELECTOR = 'a[href*="antigravity"]';

// Google OAuth selectors
const EMAIL_SELECTOR = '#identifierId';
const EMAIL_NEXT_SELECTOR = '#identifierNext button';
const PASSWORD_SELECTOR = 'input[type="password"], #password input';
const PASSWORD_NEXT_SELECTOR = '#passwordNext button';
const I_UNDERSTAND_SELECTOR = '#gaplustosNext button';
const LOGIN_SELECTOR = '#submit_approve_access button';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Helper: click a button by its visible text content
async function clickButtonByText(page, text, timeout = 10000) {
  const btn = await page.waitForFunction(
    (txt) => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find((b) => b.textContent.includes(txt));
    },
    { timeout },
    text
  );
  await btn.click();
}

// Helper: take a screenshot on error
async function takeErrorScreenshot(page, label) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const filename = path.join(SCREENSHOT_DIR, `error_${label}_${Date.now()}.png`);
    await page.screenshot({ path: filename, fullPage: true });
    console.log('  Screenshot saved: ' + filename);
  } catch (e) {
    console.log('  (Could not save screenshot: ' + e.message + ')');
  }
}

function readAccounts() {
  const content = fs.readFileSync(ACCOUNT_FILE, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => {
    const [email, password] = line.trim().split('|');
    return { email, password, raw: line.trim() };
  }).filter((a) => a.email && a.password);
}

function removeAccount(rawLine) {
  const content = fs.readFileSync(ACCOUNT_FILE, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim() !== rawLine);
  fs.writeFileSync(ACCOUNT_FILE, lines.join('\n'));
}

async function loginAccount(account, index, total) {
  const { email, password } = account;
  console.log('\n=== Account ' + (index + 1) + '/' + total + ': ' + email + ' ===');

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();

  try {
    // --- Navigate directly to Antigravity page ---
    const ANTIGRAVITY_URL = 'http://localhost:20128/dashboard/providers/antigravity';
    console.log('Navigating to ' + ANTIGRAVITY_URL);
    await page.goto(ANTIGRAVITY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // --- Click "Add" button (green button with "+ Add" or "Add Connection" text) ---
    console.log('Clicking Add button...');
    const addBtn = await page.waitForFunction(
      () => {
        // Search all buttons and links for one containing "Add"
        const elements = [...document.querySelectorAll('button, a')];
        return elements.find((el) => {
          const text = el.textContent.trim();
          return (text.includes('Add') && !text.includes('Adapter') && !text.includes('Address'));
        });
      },
      { timeout: 15000 }
    );
    await addBtn.click();
    await sleep(2000);

    // --- Click confirmation button if a modal appears ---
    console.log('Checking for confirmation dialog...');
    try {
      // Look for a confirm/continue button in a modal (red button or any confirm-style button)
      const confirmBtn = await page.waitForFunction(
        () => {
          const buttons = [...document.querySelectorAll('button')];
          return buttons.find((b) =>
            b.textContent.includes('Confirm') ||
            b.textContent.includes('Continue') ||
            b.textContent.includes('I Understand') ||
            b.textContent.includes('Yes')
          );
        },
        { timeout: 5000 }
      );
      await confirmBtn.click();
      console.log('  Confirmation dialog clicked.');
    } catch {
      console.log('  No confirmation dialog found, continuing...');
    }

    // --- Wait for Google OAuth tab ---
    console.log('Waiting for new tab...');
    await sleep(5000);

    const pages = await browser.pages();
    const newTab = pages[pages.length - 1];
    await newTab.bringToFront();

    // --- Google OAuth flow ---
    console.log('Typing email: ' + email);
    await newTab.waitForSelector(EMAIL_SELECTOR, { timeout: 15000 });
    await newTab.type(EMAIL_SELECTOR, email, { delay: 50 });

    console.log('Clicking Next (email)...');
    await newTab.waitForSelector(EMAIL_NEXT_SELECTOR, { timeout: 10000 });
    await newTab.click(EMAIL_NEXT_SELECTOR);

    console.log('Waiting for password field...');
    await newTab.waitForSelector(PASSWORD_SELECTOR, { visible: true, timeout: 15000 });
    await sleep(1500);
    await newTab.type(PASSWORD_SELECTOR, password, { delay: 50 });

    console.log('Clicking Next (password)...');
    await newTab.waitForSelector(PASSWORD_NEXT_SELECTOR, { timeout: 10000 });
    await newTab.click(PASSWORD_NEXT_SELECTOR);

    // --- "I Understand" step (may not always appear) ---
    console.log('Checking for I Understand...');
    try {
      await newTab.waitForSelector(I_UNDERSTAND_SELECTOR, { visible: true, timeout: 10000 });
      await sleep(1000);
      await newTab.click(I_UNDERSTAND_SELECTOR);
      console.log('  Clicked I Understand.');
    } catch {
      console.log('  I Understand step not found, skipping...');
    }

    // --- "Allow" / Login step ---
    console.log('Checking for Login/Allow...');
    try {
      await newTab.waitForSelector(LOGIN_SELECTOR, { visible: true, timeout: 10000 });
      await sleep(1000);
      await newTab.click(LOGIN_SELECTOR);
      console.log('  Clicked Login/Allow.');
    } catch {
      console.log('  Login/Allow step not found, skipping...');
    }

    console.log('✅ Account ' + (index + 1) + ' login successful!');

    removeAccount(account.raw);
    console.log('Removed from account.txt: ' + email);

  } catch (err) {
    console.error('❌ Account ' + (index + 1) + ' FAILED: ' + err.message);
    await takeErrorScreenshot(page, `account_${index + 1}`);
    console.log('Skipping this account and continuing...');
  } finally {
    await sleep(3000);
    await browser.close();
    console.log('Browser closed.');
  }
}

(async () => {
  const accounts = readAccounts();
  console.log('Total accounts: ' + accounts.length);

  if (accounts.length === 0) {
    console.log('No accounts found in account.txt. Exiting.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < accounts.length; i++) {
    try {
      await loginAccount(accounts[i], i, accounts.length);
      successCount++;
    } catch (err) {
      console.error('Fatal error on account ' + (i + 1) + ': ' + err.message);
      failCount++;
    }

    if (i < accounts.length - 1) {
      console.log('Delay 3 seconds before next account...');
      await sleep(3000);
    }
  }

  console.log('\n========================================');
  console.log('Done! Success: ' + successCount + ' | Failed: ' + failCount + ' | Total: ' + accounts.length);
  console.log('========================================');
})();