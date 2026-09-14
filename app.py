import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "server-data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "jobs.sqlite3"

WORKERS = [
    {"id": "akhilesh", "name": "Akhilesh"},
    {"id": "user2", "name": "User 2"},
    {"id": "user3", "name": "User 3"},
]

ALLOWED_EXTENSIONS = {".pdf"}

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_UPLOAD_MB", "100")) * 1024 * 1024


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def ensure_storage():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            create table if not exists jobs (
              id text primary key,
              status text not null,
              assigned_to text not null,
              original_name text not null,
              upload_path text not null,
              created_at text not null,
              updated_at text not null,
              log_json text not null,
              result_json text,
              error text
            )
            """
        )
        connection.commit()


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def row_to_job(row):
    if row is None:
        return None

    return {
        "id": row["id"],
        "status": row["status"],
        "assignedTo": row["assigned_to"],
        "originalName": row["original_name"],
        "uploadPath": row["upload_path"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "log": json.loads(row["log_json"] or "[]"),
        "result": json.loads(row["result_json"]) if row["result_json"] else None,
        "error": row["error"],
    }


def get_job(job_id):
    with get_connection() as connection:
        row = connection.execute("select * from jobs where id = ?", (job_id,)).fetchone()
        return row_to_job(row)


def update_job(job_id, patch):
    allowed = {
        "status": "status",
        "assignedTo": "assigned_to",
        "originalName": "original_name",
        "uploadPath": "upload_path",
        "error": "error",
    }
    assignments = []
    values = []

    for api_key, column in allowed.items():
        if api_key in patch:
            assignments.append(f"{column} = ?")
            values.append(patch[api_key])

    if "result" in patch:
        assignments.append("result_json = ?")
        values.append(json.dumps(patch["result"]))

    assignments.append("updated_at = ?")
    values.append(utc_now())
    values.append(job_id)

    with get_connection() as connection:
        connection.execute(
            f"update jobs set {', '.join(assignments)} where id = ?",
            tuple(values),
        )
        connection.commit()

    return get_job(job_id)


def append_log(job_id, message):
    with get_connection() as connection:
        row = connection.execute("select log_json from jobs where id = ?", (job_id,)).fetchone()
        if row is None:
            return None
        log = json.loads(row["log_json"] or "[]")
        log.append(str(message))
        connection.execute(
            "update jobs set log_json = ?, updated_at = ? where id = ?",
            (json.dumps(log), utc_now(), job_id),
        )
        connection.commit()

    return get_job(job_id)


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.get("/api/config")
def api_config():
    return jsonify({"workers": WORKERS})


@app.get("/api/jobs")
def list_jobs():
    with get_connection() as connection:
        rows = connection.execute("select * from jobs order by created_at desc").fetchall()
    return jsonify({"jobs": [row_to_job(row) for row in rows]})


@app.get("/api/jobs/<job_id>")
def api_get_job(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found."}), 404
    return jsonify({"job": job})


@app.get("/api/jobs/<job_id>/file")
def api_get_file(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found."}), 404

    upload_path = Path(job["uploadPath"])
    if not upload_path.exists():
        return jsonify({"error": "Uploaded file is missing on server."}), 404

    return send_file(upload_path, as_attachment=True, download_name=job["originalName"])


@app.post("/api/jobs")
def create_job():
    uploaded_file = request.files.get("file")
    assigned_to = request.form.get("assignedTo")

    if uploaded_file is None or uploaded_file.filename == "":
        return jsonify({"error": "Upload a PDF file first."}), 400

    if not any(worker["id"] == assigned_to for worker in WORKERS):
        return jsonify({"error": "Choose a valid user for this job."}), 400

    original_name = uploaded_file.filename
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Only PDF files are allowed."}), 400

    job_id = str(uuid.uuid4())
    safe_name = secure_filename(original_name) or f"{job_id}.pdf"
    stored_name = f"{job_id}-{safe_name}"
    upload_path = UPLOAD_DIR / stored_name
    uploaded_file.save(upload_path)

    now = utc_now()
    job = {
        "id": job_id,
        "status": "queued",
        "assignedTo": assigned_to,
        "originalName": original_name,
        "uploadPath": str(upload_path),
        "createdAt": now,
        "updatedAt": now,
        "log": [f"Job queued for {assigned_to}."],
        "result": None,
        "error": None,
    }

    with get_connection() as connection:
        connection.execute(
            """
            insert into jobs (
              id, status, assigned_to, original_name, upload_path,
              created_at, updated_at, log_json, result_json, error
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job["id"],
                job["status"],
                job["assignedTo"],
                job["originalName"],
                job["uploadPath"],
                job["createdAt"],
                job["updatedAt"],
                json.dumps(job["log"]),
                None,
                None,
            ),
        )
        connection.commit()

    return jsonify({"job": job}), 201


@app.post("/api/workers/<worker_id>/claim")
def claim_job(worker_id):
    now = utc_now()

    with get_connection() as connection:
        connection.execute("begin immediate")
        row = connection.execute(
            """
            select * from jobs
            where status = 'queued' and assigned_to = ?
            order by created_at asc
            limit 1
            """,
            (worker_id,),
        ).fetchone()

        if row is None:
            connection.commit()
            return jsonify({"job": None})

        log = json.loads(row["log_json"] or "[]")
        log.append(f"Claimed by worker {worker_id}.")
        connection.execute(
            "update jobs set status = 'running', updated_at = ?, log_json = ? where id = ?",
            (now, json.dumps(log), row["id"]),
        )
        connection.commit()

    return jsonify({"job": get_job(row["id"])})


@app.post("/api/jobs/<job_id>/log")
def api_append_log(job_id):
    data = request.get_json(silent=True) or {}
    message = data.get("message")
    if not message:
        return jsonify({"error": "message is required."}), 400

    job = append_log(job_id, message)
    if not job:
        return jsonify({"error": "Job not found."}), 404
    return jsonify({"job": job})


@app.patch("/api/jobs/<job_id>")
def api_update_job(job_id):
    patch = request.get_json(silent=True) or {}
    if not get_job(job_id):
        return jsonify({"error": "Job not found."}), 404

    job = update_job(job_id, patch)
    return jsonify({"job": job})


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"error": "Uploaded file is too large."}), 413


ensure_storage()

if __name__ == "__main__":
    port = int(os.environ.get("SERVER_PORT") or os.environ.get("PORT") or 5000)
    app.run(host="0.0.0.0", port=port)
