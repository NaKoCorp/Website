import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Eleventy from "@11ty/eleventy";

// Builds `input` with the repo's Eleventy config into a fresh temporary
// directory and returns that directory's path. BLOG_DRAFTS is set for the
// duration of the build only.
export async function buildSite({ drafts = false, input = "src" } = {}) {
  const outDir = await mkdtemp(join(tmpdir(), "nakocorp-site-"));
  const previous = process.env.BLOG_DRAFTS;
  if (drafts) process.env.BLOG_DRAFTS = "1";
  else delete process.env.BLOG_DRAFTS;
  try {
    const elev = new Eleventy(input, outDir, { configPath: "eleventy.config.js" });
    await elev.write();
  } catch (error) {
    await rm(outDir, { recursive: true, force: true });
    throw error;
  } finally {
    if (previous === undefined) delete process.env.BLOG_DRAFTS;
    else process.env.BLOG_DRAFTS = previous;
  }
  return outDir;
}
