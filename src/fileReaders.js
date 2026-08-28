import fs from "node:fs/promises";
import mammoth from "mammoth";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".xml"
]);

export async function readUploadedFile(filePath, originalName) {
  const extension = path.extname(originalName).toLowerCase();

  if (TEXT_EXTENSIONS.has(extension)) {
    return fs.readFile(filePath, "utf8");
  }

  if (extension === ".docx") {
    return readDocxText(filePath);
  }

  throw new Error(
    `Cannot read ${extension || "this file type"} yet. Use TXT/MD/CSV/HTML/XML for now, or add a reader for PDF/DOCX.`
  );
}

export async function readDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}
