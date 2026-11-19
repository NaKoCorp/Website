// Directory data shared by src/<lang>/blog/. BLOG_DRAFTS is read when the data
// is evaluated (not at import time) so consecutive builds in one process each
// see their own value.
const showDrafts = () => process.env.BLOG_DRAFTS === "1";

export function blogData(lang) {
  return {
    lang,
    layout: "layouts/article.njk",
    permalink(data) {
      if (data.draft && !showDrafts()) return false;
      return `/${lang}/blog/${data.page.fileSlug}/`;
    },
    eleventyComputed: {
      // The Atom feed plugin reads `summary`.
      summary: (data) => data.description,
      eleventyExcludeFromCollections: (data) => Boolean(data.draft) && !showDrafts(),
    },
  };
}
