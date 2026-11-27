// The last census of the Barking network (see lib/network.js), for the
// network page and /network/nodes.json. The file comes from the Pages
// workflow: a fresh `barking census`, else the census the live site
// publishes. Without one, the page shows its empty state.
//
// NETWORK_CENSUS overrides the path (tests use a fixture).

import { readFileSync } from "node:fs";
import { byCountry, cleanCensus, mapLayers, operatorCount } from "../../lib/network.js";

const DEFAULT_PATH = "network/nodes.json";

function load(path) {
  try {
    return cleanCensus(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export default function () {
  const census = load(process.env.NETWORK_CENSUS || DEFAULT_PATH);
  const countries = census ? byCountry(census.nodes) : [];
  return {
    census,
    countries,
    operators: census ? operatorCount(census.nodes) : 0,
    map: mapLayers(countries),
  };
}
