# InDesign Connector

A local/web hybrid app for accepting uploaded PDFs from a small group of users, sending each job through ExtractorPro, pasting the copied text into Adobe InDesign, then handling `$...$` math expressions one by one through MathML conversion.

## First setup

```powershell
npm install
Copy-Item config.example.json config.json
npm run dev
```

Open `http://localhost:3000`.

## User assignment

Jobs are assigned by user name. The default users are:

- `akhilesh`
- `user2`
- `user3`

The upload page lets the uploader choose which user should process the job.

For the hosted setup, each InDesign computer runs a local worker configured with one worker ID:

```powershell
Copy-Item worker.config.example.json worker.config.json
npm run worker
```

In `worker.config.json`, set `workerId` to the matching user name and set `apiBaseUrl` to the hosted website URL.

## Storage

The app supports two storage modes:

- `memory`: local testing only. Jobs disappear when the server restarts.
- `supabase`: production mode for Vercel. Jobs are stored in Supabase Database and uploaded files are stored in Supabase Storage.

To prepare Supabase:

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Create a private Storage bucket named `indesign-jobs`.
4. Set these environment variables:

```text
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then change `config.json`:

```json
"storage": {
  "provider": "supabase"
}
```

## Workflow status

Implemented:

- Upload page and job dashboard.
- Job assignment by user name.
- Worker claim API for local InDesign computers.
- Separate `npm run worker` local-worker command.
- Memory storage for local testing.
- Supabase database/file storage support for Vercel production.
- ExtractorPro PDF to Word workflow.
- Optional ExtractorPro login through `.env`.
- Raw copied text is pasted into InDesign before equation processing.
- `$...$` equation detection after the InDesign paste step.
- One-by-one conversion through latex2mathml-web.
- InDesign JavaScript generation for the initial paste step.
- MathML insertion plan generation for the final InDesign plugin step.
- Optional InDesign COM runner hook for Windows.

Still needs:

- Supabase project credentials from you.
- GitHub repository URL for pushing.
- Vercel project connection after GitHub push.
- A real PDF end-to-end test on an InDesign computer.
- Final automation for `Window -> Maths expression -> Insert MathML -> Place`.
