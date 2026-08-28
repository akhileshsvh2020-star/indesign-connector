import { appendLog, finishActiveJob, nextQueuedJob, updateJob } from "./jobStore.js";
import { readUploadedFile } from "./fileReaders.js";
import { splitDollarMath } from "./math.js";
import { convertEquationToMathML, runSourceWebsiteWorkflow } from "./workflow/browserWorkflow.js";
import { createInitialPasteScript, createMathInsertionPlan, runInDesignScript } from "./workflow/indesign.js";

export function startWorker(config) {
  async function tick() {
    const job = nextQueuedJob();
    if (!job) return;

    try {
      updateJob(job.id, { status: "running" });
      appendLog(job.id, "Checking uploaded file.");
      if (!job.originalName.toLowerCase().endsWith(".pdf")) {
        await readUploadedFile(job.uploadPath, job.originalName);
      }

      appendLog(job.id, "Running ExtractorPro PDF to Word workflow.");
      const websiteOutput = await runSourceWebsiteWorkflow(config.sourceWebsite, job.uploadPath);
      appendLog(job.id, "Downloaded Word output and copied its text.");

      appendLog(job.id, "Creating InDesign raw-text paste script.");
      const initialScriptPath = await createInitialPasteScript(job.id, websiteOutput, config.indesign);

      appendLog(job.id, "Pasting the full copied text into InDesign first.");
      const initialInDesignResult = await runInDesignScript(initialScriptPath, config.indesign);

      appendLog(job.id, "Detecting equations in the pasted InDesign text by dollar symbols.");
      const pastedInDesignParts = splitDollarMath(websiteOutput);
      const equationParts = pastedInDesignParts.filter((part) => part.type === "equation");
      appendLog(job.id, `Detected ${equationParts.length} equation(s) after the InDesign paste step.`);

      const convertedEquations = [];
      for (const [index, part] of equationParts.entries()) {
        appendLog(job.id, `Equation ${index + 1}: copying text between dollar symbols: ${part.source}`);
        const mathML = await convertEquationToMathML(config.mathConverter, part.source);
        convertedEquations.push({
          index: index + 1,
          sourceWithoutDollarSymbols: part.source,
          mathML
        });
        appendLog(job.id, `Equation ${index + 1}: MathML copied from GitHub converter.`);
      }

      appendLog(job.id, "Creating InDesign MathML insertion plan.");
      const mathInsertionPlanPath = await createMathInsertionPlan(job.id, convertedEquations, config.indesign);

      updateJob(job.id, {
        status: "done",
        result: {
          initialScriptPath,
          mathInsertionPlanPath,
          indesign: initialInDesignResult
        }
      });
      appendLog(job.id, "Job finished.");
    } catch (error) {
      updateJob(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      appendLog(job.id, "Job failed.");
    } finally {
      finishActiveJob(job.id);
    }
  }

  setInterval(() => {
    tick().catch(() => {});
  }, 1500);
}
