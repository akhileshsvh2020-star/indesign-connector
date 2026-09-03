# Simple Connector Setup

Use this setup on the Windows computer that has Adobe InDesign installed.

## First Time Setup

1. Install Node.js.
2. Install Git.
3. Open PowerShell on Desktop.
4. Clone the project:

```powershell
git clone https://github.com/akhileshsvh2020-star/indesign-connector.git
```

5. Open the `indesign-connector` folder.
6. Double-click `start-worker.bat`.

The first run may install packages and Playwright Chromium. This can take a few minutes.

## Required Files

Before running jobs, make sure these two files exist in the `indesign-connector` folder:

- `worker.config.json`
- `.env`

`worker.config.json` should contain the correct worker:

```json
{
  "workerId": "akhilesh",
  "apiBaseUrl": "https://indesign-connector.vercel.app",
  "pollIntervalMs": 3000
}
```

`.env` should contain the real credentials:

```env
SUPABASE_URL=https://xdyfaexdunuizgypfbyv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-real-supabase-service-role-key
EXTRACTORPRO_EMAIL=your-extractorpro-email
EXTRACTORPRO_PASSWORD=your-extractorpro-password
```

Do not add quotes, commas, or brackets in `.env`.

## Daily Use

1. Turn on the InDesign computer.
2. Open Adobe InDesign.
3. Open the `indesign-connector` folder.
4. Double-click `start-worker.bat`.
5. Keep the worker window open.
6. Upload a new PDF from:

```text
https://indesign-connector.vercel.app
```

## Stop Worker

In the worker window, press:

```text
CTRL+C
Y
```

Then close the window.

## Common Errors

If the worker says Playwright browser is missing, run:

```powershell
npx.cmd playwright install chromium
```

If ExtractorPro login fails, check `.env`, then run the worker again and watch the browser window for captcha, OTP, or popups.
