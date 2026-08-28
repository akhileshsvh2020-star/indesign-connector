# Deployment Notes

## Important InDesign limitation

Adobe InDesign automation must run on the computer where InDesign is installed. A Vercel-hosted website cannot directly click menus or run scripts inside InDesign on a user's laptop.

For the final system there are two practical options:

1. Run this app locally on each InDesign computer. Users open `http://localhost:3000` on their own machine.
2. Host a central website, then install a small local InDesign worker on each user's computer. The website sends jobs to the worker, and the worker controls local InDesign.

The current project is built as a local worker/web app. It can be pushed to GitHub, but deploying this exact Node/Playwright/InDesign worker to Vercel will not complete the InDesign part by itself.

## ExtractorPro login

When credentials are ready, create `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Then fill:

```text
EXTRACTORPRO_EMAIL=your-email
EXTRACTORPRO_PASSWORD=your-password
```

The app will log in to ExtractorPro automatically before using `Convert -> PDF to Word`.

