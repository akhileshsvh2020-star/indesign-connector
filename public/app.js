const form = document.querySelector("#uploadForm");
const fileInput = document.querySelector("#fileInput");
const jobsList = document.querySelector("#jobsList");
const refreshButton = document.querySelector("#refreshButton");
const counters = {
  queued: document.querySelector("#queuedCount"),
  running: document.querySelector("#runningCount"),
  done: document.querySelector("#doneCount")
};

function statusClass(status) {
  if (status === "failed") return "badge failed";
  if (status === "running") return "badge running";
  return "badge";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderJobs(jobs) {
  const counts = { queued: 0, running: 0, done: 0 };
  for (const job of jobs) {
    if (counts[job.status] !== undefined) counts[job.status] += 1;
  }

  counters.queued.textContent = counts.queued;
  counters.running.textContent = counts.running;
  counters.done.textContent = counts.done;

  if (jobs.length === 0) {
    jobsList.innerHTML = '<div class="job"><p class="job-meta">No jobs uploaded yet.</p></div>';
    return;
  }

  jobsList.innerHTML = jobs.map((job) => {
    const log = escapeHtml(job.log.slice(-5).join("\n"));
    const result = job.result?.initialScriptPath
      ? `<p class="job-result">Raw paste script: ${escapeHtml(job.result.initialScriptPath)}</p>
         <p class="job-result">Math insertion plan: ${escapeHtml(job.result.mathInsertionPlanPath)}</p>`
      : "";
    const error = job.error ? `<p class="job-result">Error: ${escapeHtml(job.error)}</p>` : "";

    return `
      <article class="job">
        <div class="job-title">
          <div>
            <strong>${escapeHtml(job.originalName)}</strong>
            <p class="job-meta">${escapeHtml(new Date(job.createdAt).toLocaleString())}</p>
          </div>
          <span class="${statusClass(job.status)}">${escapeHtml(job.status)}</span>
        </div>
        ${result}
        ${error}
        <pre class="job-log">${log}</pre>
      </article>
    `;
  }).join("");
}

async function loadJobs() {
  const response = await fetch("/api/jobs");
  const data = await response.json();
  renderJobs(data.jobs);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const response = await fetch("/api/jobs", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const data = await response.json();
    alert(data.error ?? "Upload failed.");
    return;
  }

  fileInput.value = "";
  await loadJobs();
});

refreshButton.addEventListener("click", loadJobs);
setInterval(loadJobs, 3000);
loadJobs();
