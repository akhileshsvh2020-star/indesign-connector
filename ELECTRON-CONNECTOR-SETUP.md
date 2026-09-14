# Electron Connector Setup

This is the user-friendly connector app for the Windows computer that has Adobe InDesign installed.

## First-Time Setup For Testing

For now, run it from the project folder:

```powershell
cd Desktop\indesign-connector
git pull
npm.cmd install
npm.cmd run connector
```

The connector app window will open.

## What The Buttons Do

- `Start Connector`: starts the local worker and begins polling the website for jobs.
- `Stop`: stops the worker.
- `Open Website`: opens the configured upload website.
- `Worker Config`: opens `worker.config.json`.
- `Credentials`: opens `.env`.
- `Update Code`: runs `git pull`.

## Required Worker Config

Open `Worker Config` and make sure this value points to the Python/Pterodactyl server:

```json
"apiBaseUrl": "http://indesign.extractorpro.in:10039"
```

Keep the other workflow settings in the file.

## Required Credentials

Open `Credentials` and make sure `.env` has the ExtractorPro login details:

```env
EXTRACTORPRO_EMAIL=your-email
EXTRACTORPRO_PASSWORD=your-password
```

Do not add quotes or commas.

## Daily Use

1. Open Adobe InDesign.
2. Open the connector app.
3. Click `Start Connector`.
4. Upload a PDF from the website.
5. If Chrome opens and asks for ExtractorPro login, login in that same Chrome window.

## Later Packaging

After the connector is tested, build the Windows connector app folder:

```powershell
npm.cmd run package:connector
```

The app will be created at `connector-dist/win-unpacked/InDesign Connector.exe`. Copy the full `win-unpacked` folder to the InDesign computer and double-click `InDesign Connector.exe`.

