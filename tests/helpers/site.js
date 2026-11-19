import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildSite } from "./build.js";

// Entries of src/ that produce passthrough copies. They are left out of the
// temporary input so a build that rejects has no copy still in flight when the
// input is removed.
const PASSTHROUGH = new Set(["index.html", "assets", "CNAME"]);

// Builds a temporary copy of src/ plus `files` ({ "en/blog/a.md": "..." }) and
// calls `fn(outDir, inputDir)`. Temp input and output are always removed.
// The input lives at the repo root, next to src/, so the `../lib/*` imports of
// copied data files resolve. It is passed relative: Eleventy ignores directory
// data under an absolute input. (A crashed run can leave .tmp-src-* behind.)
export async function withSite(files, fn, { drafts = false } = {}) {
  const input = await mkdtemp(join(process.cwd(), ".tmp-src-"));
  let out;
  try {
    await cp("src", input, {
      recursive: true,
      filter: (source) => !PASSTHROUGH.has(relative("src", source)),
    });
    for (const [path, content] of Object.entries(files)) {
      await mkdir(join(input, path, ".."), { recursive: true });
      await writeFile(join(input, path), content);
    }
    out = await buildSite({ input: relative(process.cwd(), input), drafts });
    await fn(out, input);
  } finally {
    await rm(input, { recursive: true, force: true });
    if (out) await rm(out, { recursive: true, force: true });
  }
}
