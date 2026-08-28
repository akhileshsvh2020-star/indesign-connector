import { readUploadedFile } from "./fileReaders.js";
import { splitDollarMath } from "./math.js";
import { convertEquationToMathML, runSourceWebsiteWorkflow } from "./workflow/browserWorkflow.js";
import { createInitialPasteScript, createMathInsertionPlan, runInDesignScript } from "./workflow/indesign.js";

export async function processJob(job, config, callbacks = {}) {
  const log = callbacks.log;
  const update = callbacks.update;

  if (!log || !update) {
    throw new Error("processJob requires log and update callbacks.");
  }

  try {
    await update({ status: "running", error: null });
    await log("Checking uploaded file.");
    if (!job.originalName.toLowerCase().endsWith(".pdf")) {
      await readUploadedFile(job.uploadPath, job.originalName);
    }

    await log("Running ExtractorPro PDF to Word workflow.");
    const websiteOutput = await runSourceWebsiteWorkflow(config.sourceWebsite, job.uploadPath);
    await log("Downloaded Word output and copied its text.");

    await log("Creating InDesign raw-text paste script.");
    const initialScriptPath = await createInitialPasteScript(job.id, websiteOutput, config.indesign);

    await log("Pasting the full copied text into InDesign first.");
    const initialInDesignResult = await runInDesignScript(initialScriptPath, config.indesign);

    await log("Detecting equations in the pasted InDesign text by dollar symbols.");
    const pastedInDesignParts = splitDollarMath(websiteOutput);
    const equationParts = pastedInDesignParts.filter((part) => part.type === "equation");
    await log(`Detected ${equationParts.length} equation(s) after the InDesign paste step.`);

    const convertedEquations = [];
    for (const [index, part] of equationParts.entries()) {
      await log(`Equation ${index + 1}: copying text between dollar symbols: ${part.source}`);
      const mathML = await convertEquationToMathML(config.mathConverter, part.source);
      convertedEquations.push({
        index: index + 1,
        sourceWithoutDollarSymbols: part.source,
        mathML
      });
      await log(`Equation ${index + 1}: MathML copied from GitHub converter.`);
    }

    await log("Creating InDesign MathML insertion plan.");
    const mathInsertionPlanPath = await createMathInsertionPlan(job.id, convertedEquations, config.indesign);

    const result = {
      initialScriptPath,
      mathInsertionPlanPath,
      indesign: initialInDesignResult
    };
    await update({ status: "done", result });
    await log("Job finished.");
    return result;
  } catch (error) {
    await update({
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    });
    await log("Job failed.");
    throw error;
  }
}

export function startWorker(config, workerId, store) {
  async function tick() {
    if (!workerId || !store) return;
    const job = await store.claimJob(workerId);
    if (!job) return;

    await processJob(job, config, {
      log: (message) => store.appendLog(job.id, message),
      update: (patch) => store.updateJob(job.id, patch)
    });
  }

  setInterval(() => {
    tick().catch((error) => console.error(error));
  }, 1500);
}
