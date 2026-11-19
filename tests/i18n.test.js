import { test } from "node:test";
import assert from "node:assert/strict";
import { labels, formatDate, readingTime } from "../lib/i18n.js";

test("formatDate formats English and French dates in UTC", () => {
  assert.equal(formatDate(new Date("2026-12-02"), "en"), "December 2, 2026");
  assert.equal(formatDate(new Date("2026-12-02"), "fr"), "2 décembre 2026");
});

test("readingTime rounds up at 230 words per minute, minimum 1", () => {
  assert.equal(readingTime("word ".repeat(460)), 2);
  assert.equal(readingTime("word ".repeat(461)), 3);
  assert.equal(readingTime("<p>hi</p>"), 1);
  assert.equal(readingTime(""), 1);
});

test("readingTime ignores HTML tags", () => {
  const html = `<p class="${"word ".repeat(1000)}">hi</p>`;
  assert.equal(readingTime(html), 1);
});

test("labels.fr has exactly the keys of labels.en", () => {
  assert.deepEqual(Object.keys(labels.fr).sort(), Object.keys(labels.en).sort());
});

test("labels include the required keys", () => {
  for (const key of [
    "home", "blog", "minRead", "themeToggle", "themeLight", "themeDark", "readIn",
    "prototypeTitle", "prototypeBody", "ctaStar", "ctaRelay", "ctaSponsor",
    "previous", "next", "frenchMark",
  ]) {
    assert.ok(labels.en[key], `missing en.${key}`);
  }
});

test("no label contains an em-dash", () => {
  for (const lang of ["en", "fr"]) {
    for (const [key, value] of Object.entries(labels[lang])) {
      assert.ok(!value.includes("—"), `${lang}.${key} contains an em-dash`);
    }
  }
});

test("French punctuation : ; ? ! is preceded by a no-break space", () => {
  for (const [key, value] of Object.entries(labels.fr)) {
    for (let i = 0; i < value.length; i++) {
      if (":;?!".includes(value[i])) {
        assert.match(value[i - 1] ?? "", /[\u00a0\u202f]/, `fr.${key} has "${value[i]}" without a no-break space`);
      }
    }
  }
});
