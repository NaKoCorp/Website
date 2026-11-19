import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTranslations } from "../lib/translations.js";

const page = (lang, translationKey, inputPath, draft = false) => ({ lang, translationKey, draft, inputPath });

test("passes for a published EN/FR pair", () => {
  checkTranslations([
    page("en", "a", "src/en/blog/a.md"),
    page("fr", "a", "src/fr/blog/a.md"),
  ]);
});

test("throws naming the file when the French version is missing", () => {
  assert.throws(() => checkTranslations([page("en", "a", "src/en/blog/a.md")]), /src\/en\/blog\/a\.md/);
});

test("throws when the French version is a draft", () => {
  assert.throws(
    () => checkTranslations([
      page("en", "a", "src/en/blog/a.md"),
      page("fr", "a", "src/fr/blog/a.md", true),
    ]),
    /src\/en\/blog\/a\.md/,
  );
});

test("does not throw when the English article is itself a draft", () => {
  checkTranslations([page("en", "a", "src/en/blog/a.md", true)]);
});

test("throws naming both files when a translationKey is duplicated in one language", () => {
  assert.throws(
    () => checkTranslations([
      page("en", "a", "src/en/blog/a.md"),
      page("en", "a", "src/en/blog/b.md"),
      page("fr", "a", "src/fr/blog/a.md"),
    ]),
    (err) => err.message.includes("src/en/blog/a.md") && err.message.includes("src/en/blog/b.md"),
  );
});

test("checks the French-to-English direction too", () => {
  assert.throws(() => checkTranslations([page("fr", "a", "src/fr/blog/a.md")]), /src\/fr\/blog\/a\.md/);
});
