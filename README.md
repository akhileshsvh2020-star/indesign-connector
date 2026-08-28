# InDesign Connector

A local web app for accepting uploaded PDFs from a small group of users, sending each job through ExtractorPro, pasting the copied text into Adobe InDesign, then handling `$...$` math expressions one by one through MathML conversion.

## First setup

```powershell
npm install
Copy-Item config.example.json config.json
npm run dev
```

Open `http://localhost:3000`.

For other users on the same network, use this computer's LAN IP, for example `http://192.168.1.25:3000`.

## Workflow status

Implemented:

- Upload page and job dashboard.
- Single-worker queue so InDesign jobs run one at a time.
- Uploaded file text extraction for text-like files.
- ExtractorPro PDF to Word workflow.
- Raw copied text is pasted into InDesign before equation processing.
- `$...$` equation detection after the InDesign paste step.
- One-by-one conversion through latex2mathml-web.
- InDesign JavaScript generation for the initial paste step.
- MathML insertion plan generation for the final InDesign plugin step.
- Optional InDesign COM runner hook for Windows.

Needs your exact details:

- The exact InDesign math plugin behavior if we need to click `Window -> Maths expression -> Insert MathML` instead of using a scriptable API.
