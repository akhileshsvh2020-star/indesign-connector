# Deployment Notes

## Important InDesign limitation

Adobe InDesign automation must run on the computer where InDesign is installed. A Vercel-hosted website cannot directly click menus or run scripts inside InDesign on a user's laptop.

For the final system there are two practical options:

1. Run this app locally on each InDesign computer. Users open `http://localhost:3000` on their own machine.
2. Host a central website, then install a small local InDesign worker on each user's computer. The website sends jobs to the worker, and the worker controls local InDesign.

The current project supports option 2 by adding a hosted job API plus local worker polling.

## Supabase

Vercel does not keep local files or in-memory queues permanently. Supabase is used for production because it provides both:

- Database rows for job status, assignment, logs, and results.
- Private file storage for uploaded PDFs.

Setup:

1. Create a Supabase project.
2. Open the SQL editor and run `supabase-schema.sql`.
3. Create a private Storage bucket named `indesign-jobs`.
4. Add environment variables in Vercel and on local worker computers:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Set `storage.provider` to `supabase` in production config.

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

The worker will log in to ExtractorPro automatically before using `Convert -> PDF to Word`.

## Worker assignment

Jobs are assigned by user name. Each InDesign computer should have a different `workerId` in `worker.config.json`.

Example:

```json
{
  "workerId": "akhilesh",
  "apiBaseUrl": "https://your-vercel-site.vercel.app"
}
```

When the worker runs with `npm run worker`, it polls the website for jobs assigned to that user, downloads the uploaded PDF, processes it locally, and reports status back to the website.
