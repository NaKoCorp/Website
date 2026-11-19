// Fails the build when a published article lacks a published translation,
// or when a translationKey is used twice within one language.
export function checkTranslations(pages) {
  const byLang = { en: new Map(), fr: new Map() };
  const problems = [];

  for (const page of pages) {
    const map = byLang[page.lang];
    if (!map) continue;
    const existing = map.get(page.translationKey);
    if (existing) {
      problems.push(
        `Duplicate translationKey "${page.translationKey}" in ${page.lang}: ${existing.inputPath} and ${page.inputPath}`,
      );
    } else {
      map.set(page.translationKey, page);
    }
  }

  for (const [lang, other] of [["en", "fr"], ["fr", "en"]]) {
    for (const page of byLang[lang].values()) {
      if (page.draft) continue;
      const counterpart = byLang[other].get(page.translationKey);
      if (!counterpart || counterpart.draft) {
        problems.push(
          `${page.inputPath} has no published ${other} translation (translationKey "${page.translationKey}")`,
        );
      }
    }
  }

  if (problems.length) throw new Error(problems.join("\n"));
}
