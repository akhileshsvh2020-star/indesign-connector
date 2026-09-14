# Python Server Setup

Use this for the Pterodactyl server that runs Python 3.12 with:

```bash
python app.py
```

## Files Needed On Server

Upload these project files/folders to the Pterodactyl server:

- `app.py`
- `requirements.txt`
- `public/`

The server will create this folder automatically:

- `server-data/`

Uploaded PDFs and the SQLite job database are stored inside `server-data/`.

## Startup Command

Use this startup command:

```bash
if [ -f "requirements.txt" ]; then pip install -r requirements.txt; fi; python app.py
```

## Port

The app reads the Pterodactyl `SERVER_PORT` variable automatically. If that is not present, it uses port `5000`.

## Connector URL

After the server is live, update `worker.config.json` on the InDesign computer. Keep all existing workflow settings in that file; only change `apiBaseUrl`:

```json
"apiBaseUrl": "https://your-real-subdomain-here"
```

Use the real subdomain or public server URL.

## Supported Uploads

Only PDF uploads are accepted in this server version.

