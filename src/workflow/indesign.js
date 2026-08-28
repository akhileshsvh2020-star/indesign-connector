import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function escapeJs(value) {
  return JSON.stringify(value ?? "");
}

export async function createInDesignScript(jobId, parts, config) {
  const outDir = path.resolve("storage", "outputs", jobId);
  await fs.mkdir(outDir, { recursive: true });

  const scriptPath = path.join(outDir, "place-content.jsx");
  const normalSize = Number(config.normalPointSize ?? 12);
  const equationSize = normalSize * Number(config.equationScale ?? 0.5);

  const serializableParts = parts.map((part) => ({
    type: part.type,
    value: part.type === "equation" ? part.mathML : part.value,
    source: part.source
  }));

  const script = `#target indesign
var contentParts = ${escapeJs(serializableParts)};
var normalPointSize = ${normalSize};
var equationPointSize = ${equationSize};

function addPageIfNeeded(doc, index) {
  if (index === 0) return doc.pages[0];
  return doc.pages.add();
}

function pageBounds(page) {
  var b = page.bounds;
  return [b[0] + 36, b[1] + 36, b[2] - 36, b[3] - 36];
}

function appendText(frame, text, size) {
  var insertion = frame.insertionPoints[-1];
  insertion.contents = text;
  var start = frame.characters.length - text.length;
  if (start >= 0 && text.length > 0) {
    frame.characters.itemByRange(start, frame.characters.length - 1).pointSize = size;
  }
}

function placeContent() {
  var doc = app.documents.add();
  var page = addPageIfNeeded(doc, 0);
  var frame = page.textFrames.add();
  frame.geometricBounds = pageBounds(page);

  for (var i = 0; i < contentParts.length; i++) {
    var part = contentParts[i];
    if (part.type === "pageBreak") {
      page = addPageIfNeeded(doc, doc.pages.length);
      frame = page.textFrames.add();
      frame.geometricBounds = pageBounds(page);
      continue;
    }

    if (part.type === "equation") {
      appendText(frame, part.value, equationPointSize);
    } else {
      appendText(frame, part.value, normalPointSize);
    }
  }
}

placeContent();
`;

  await fs.writeFile(scriptPath, script, "utf8");
  return scriptPath;
}

export async function createInitialPasteScript(jobId, rawText, config) {
  const outDir = path.resolve("storage", "outputs", jobId);
  await fs.mkdir(outDir, { recursive: true });

  const scriptPath = path.join(outDir, "paste-raw-text.jsx");
  const normalSize = Number(config.normalPointSize ?? 12);
  const pages = rawText.split(/\f|---PAGE---/g);

  const script = `#target indesign
var pages = ${escapeJs(pages)};
var normalPointSize = ${normalSize};

function addPageIfNeeded(doc, index) {
  if (index === 0) return doc.pages[0];
  return doc.pages.add();
}

function pageBounds(page) {
  var b = page.bounds;
  return [b[0] + 36, b[1] + 36, b[2] - 36, b[3] - 36];
}

function pasteRawText() {
  var doc = app.documents.add();

  for (var i = 0; i < pages.length; i++) {
    var page = addPageIfNeeded(doc, i);
    var frame = page.textFrames.add();
    frame.geometricBounds = pageBounds(page);
    frame.contents = pages[i];
    if (frame.characters.length > 0) {
      frame.characters.everyItem().pointSize = normalPointSize;
    }
  }
}

pasteRawText();
`;

  await fs.writeFile(scriptPath, script, "utf8");
  return scriptPath;
}

export async function createMathInsertionPlan(jobId, equations, config) {
  const outDir = path.resolve("storage", "outputs", jobId);
  await fs.mkdir(outDir, { recursive: true });

  const planPath = path.join(outDir, "math-insertion-plan.json");
  const normalSize = Number(config.normalPointSize ?? 12);
  const equationSize = normalSize * Number(config.equationScale ?? 0.5);
  const plan = {
    instruction:
      "Text is pasted into InDesign first. For each item, find the matching $...$ expression in InDesign, copy the source without dollars to latex2mathml-web, then insert the MathML through Window > Maths expression > Insert MathML > Place.",
    normalPointSize: normalSize,
    equationPointSize: equationSize,
    equations
  };

  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), "utf8");
  return planPath;
}

export async function runInDesignScript(scriptPath, config) {
  if (!config.enabled) {
    return { skipped: true, message: "InDesign execution is disabled in config.json." };
  }

  const runner = [
    "$app = New-Object -ComObject " + JSON.stringify(config.applicationProgId),
    "$app.DoScript(" + JSON.stringify(scriptPath) + ", 1246973031)"
  ].join("; ");

  await execFileAsync("powershell", ["-NoProfile", "-Command", runner], {
    windowsHide: true
  });

  return { skipped: false, message: "InDesign script executed." };
}
