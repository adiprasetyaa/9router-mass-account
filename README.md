# Add Mass Account AntiGravity to 9Router

A Puppeteer-based automation tool for bulk-adding Google accounts to the Antigravity provider on [9Router](https://github.com/9-Router/9Router). This bot automates the entire OAuth flow, from navigating the 9Router dashboard to completing the Google login process, for each account listed in a configuration file.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Error Handling](#error-handling)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Disclaimer](#disclaimer)

## Features

- Automated bulk addition of Google accounts to the Antigravity provider
- Reads account credentials from a simple text file (`account.txt`)
- Successfully added accounts are automatically removed from the list
- Resilient text-based selectors that adapt to UI changes
- Error handling with automatic screenshot capture on failure
- Skips failed accounts and continues processing the remaining list
- Summary report with success and failure counts after completion
- 3-second delay between accounts to avoid rate limiting

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- [9Router](https://github.com/9-Router/9Router) running locally (default: `http://localhost:20128/`)
- A stable internet connection for the Google OAuth flow

### Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| [puppeteer](https://www.npmjs.com/package/puppeteer) | ^24.43.1 | Browser automation library. Automatically downloads a compatible Chromium binary during installation. |

## Installation

```bash
# Clone the repository
git clone https://github.com/pfrfrr/Add-Mass-Account-AntiGravity-to-9Router.git
cd Add-Mass-Account-AntiGravity-to-9Router

# Install dependencies
npm install
```

> **Note:** `npm install` will automatically download Puppeteer along with a bundled Chromium browser. This requires an internet connection and may take a few minutes depending on your network speed.

### Prepare the Account List

Create a file named `account.txt` in the project root directory. Each line should contain one account in the format `email|password`:

```
account1@gmail.com|yourpassword1
account2@gmail.com|yourpassword2
account3@gmail.com|yourpassword3
```

This file is listed in `.gitignore` and will not be committed to version control.

## Configuration

### 1. Disable "Require Login" in 9Router

This step is mandatory before running the bot. If "Require Login" is enabled, the bot will not be able to access the 9Router dashboard.

1. Open the 9Router dashboard in your browser (default: `http://localhost:20128/`)
2. Navigate to **Settings**
3. Find the **Require Login** option
4. Disable it
5. Save the changes

### 2. Verify the Target URL

The bot navigates directly to the Antigravity provider page at:

```
http://localhost:20128/dashboard/providers/antigravity
```

If your 9Router instance runs on a different host or port, update the `TARGET_URL` constant at the top of `bot.js`:

```javascript
const TARGET_URL = 'http://localhost:20128/';
```

## Usage

Run the bot with:

```bash
node bot.js
```

The bot will process each account sequentially. You will see real-time progress output in the terminal:

```
Total accounts: 10

=== Account 1/10: account1@gmail.com ===
Launching browser...
Navigating to http://localhost:20128/dashboard/providers/antigravity
Clicking Add button...
Checking for confirmation dialog...
  Confirmation dialog clicked.
Waiting for new tab...
Typing email: account1@gmail.com
Clicking Next (email)...
Waiting for password field...
Clicking Next (password)...
Checking for I Understand...
Checking for Login/Allow...
  Clicked Login/Allow.
Account 1 login successful!
Removed from account.txt: account1@gmail.com
Browser closed.
Delay 3 seconds before next account...

========================================
Done! Success: 10 | Failed: 0 | Total: 10
========================================
```

## How It Works

For each account in `account.txt`, the bot performs the following steps:

1. Launches a visible (non-headless) Chromium browser instance
2. Navigates directly to the Antigravity provider page on 9Router
3. Clicks the **Add** button (or **Add Connection** if no accounts exist yet)
4. Confirms the action in the modal dialog if one appears
5. Waits for the Google OAuth tab to open
6. Enters the email address and clicks **Next**
7. Enters the password and clicks **Next**
8. Handles the **I Understand** consent screen (if present)
9. Clicks **Allow** to grant access
10. Removes the successfully added account from `account.txt`
11. Closes the browser and waits 3 seconds before the next account

The browser runs in visible mode because Google blocks headless browser access during the OAuth login flow.

## Error Handling

The bot includes several layers of error handling:

- **Per-account try/catch:** If an account fails at any step, the bot logs the error, captures a screenshot, and moves on to the next account. It does not crash.
- **Screenshot capture:** When an error occurs, a full-page screenshot is saved to the `screenshots/` directory with a timestamped filename for debugging.
- **Optional OAuth steps:** The "I Understand" and "Allow/Login" steps in the Google OAuth flow are wrapped in individual try/catch blocks, since they do not always appear depending on the account state.
- **Summary report:** After all accounts are processed, a final summary shows the total number of successes and failures.

## Project Structure

```
Add-Mass-Account-AntiGravity-to-9Router/
|-- bot.js              # Main automation script
|-- account.txt            # Account list file (not tracked by Git)
|-- screenshots/        # Error screenshots (created automatically)
|-- package.json        # Project metadata and dependencies
|-- package-lock.json   # Dependency lock file
|-- .gitignore          # Git ignore rules
|-- README.md           # This file
```

## Troubleshooting

### `npm install` fails with Puppeteer/Chrome download error

If the Chromium download fails or becomes corrupted, clear the Puppeteer cache and retry:

```bash
rm -rf ~/.cache/puppeteer/chrome/
npm install
```

### Bot fails at "Clicking Add button"

This typically means the 9Router page structure has changed, or the page has not fully loaded. Verify that:

- 9Router is running and accessible at the configured URL
- The Antigravity provider is visible on the Providers page
- "Require Login" is disabled in 9Router settings

### Google login fails or times out

- Ensure the account credentials in `account.txt` are correct
- Check that your internet connection is stable
- Google may require additional verification (CAPTCHA, 2FA) which this bot cannot handle automatically

### Bot was interrupted mid-process

If the bot is stopped before finishing (e.g., with Ctrl+C), accounts that were not yet processed remain in `account.txt`. Simply run `node bot.js` again to continue where it left off.

## Disclaimer

This tool is provided as-is for personal and educational use. It interacts with third-party services (Google OAuth, 9Router) through browser automation. Users are solely responsible for ensuring their usage complies with applicable terms of service. The author assumes no liability for misuse or any consequences arising from the use of this tool.

**USE AT YOUR OWN RISK.**
