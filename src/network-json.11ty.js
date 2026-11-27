// /network/nodes.json: the census as the page shows it (validated, no
// address), for anyone who wants the raw data and as the Pages workflow's
// fallback when a fresh census fails. Not written without a census.
export const data = {
  eleventyExcludeFromCollections: true,
  eleventyComputed: {
    permalink: (data) => (data.network.census ? "/network/nodes.json" : false),
  },
};

export function render({ network }) {
  return `${JSON.stringify(network.census, null, 2)}\n`;
}
