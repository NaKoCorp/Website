// The network page: the census written by `barking census` (Barking CLI),
// validated, and the dot map it is drawn on.
//
// The census is untrusted input (nodes describe themselves), so every field
// is checked against a strict shape and anything that looks like an IP
// address is dropped: addresses never reach the site.

import { createRequire } from "node:module";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);

export const SCHEMA = 1;
const MAX_NODES = 1000;
const MAX_TEXT = 64;
const TIERS = new Set(["low", "medium", "high", "full"]);
const ORIGINS = new Set(["matches", "mismatch", "unverifiable"]);
const ID = /^[A-Z2-7]{8}$/;
const COUNTRY = /^[A-Z]{2}$/;
// Dotted quads and anything with two colons between hex groups.
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;
const IPV6 = /[0-9a-f]{0,4}:[0-9a-f]{0,4}:/i;

const isInt = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;

/** Printable ASCII, at most MAX_TEXT bytes, never an address; else null. */
export function cleanText(v) {
  if (typeof v !== "string" || !v || v.length > MAX_TEXT) return null;
  if (!/^[\x20-\x7E]+$/.test(v)) return null;
  if (IPV4.test(v) || IPV6.test(v)) return null;
  return v;
}

function cleanNode(n) {
  if (!n || typeof n !== "object" || !ID.test(n.id)) return null;
  const code = (v) => (typeof v === "string" && COUNTRY.test(v) ? v : null);
  return {
    id: n.id,
    in_table: n.in_table === true,
    country: code(n.country),
    ip_country: code(n.ip_country),
    asn: isInt(n.asn, 2 ** 32 - 1) && n.asn > 0 ? n.asn : null,
    as_name: cleanText(n.as_name),
    origin: ORIGINS.has(n.origin) ? n.origin : "unverifiable",
    software: cleanText(n.software),
    protocol: isInt(n.protocol, 65535) ? n.protocol : null,
    uptime_secs: isInt(n.uptime_secs, 2 ** 40) ? n.uptime_secs : null,
    storage: TIERS.has(n.storage) ? n.storage : null,
    wake: TIERS.has(n.wake) ? n.wake : null,
  };
}

/**
 * The census as the site may publish it, or null if `raw` is not a census
 * of this schema. Ill-formed nodes are dropped, never repaired.
 */
export function cleanCensus(raw) {
  if (!raw || typeof raw !== "object" || raw.schema !== SCHEMA) return null;
  if (!isInt(raw.generated_at, 2 ** 40) || !Array.isArray(raw.nodes)) return null;
  const seen = new Set();
  const nodes = [];
  for (const n of raw.nodes.slice(0, MAX_NODES)) {
    const node = cleanNode(n);
    if (node && !seen.has(node.id)) {
      seen.add(node.id);
      nodes.push(node);
    }
  }
  nodes.sort((a, b) => (a.country ?? "ZZ").localeCompare(b.country ?? "ZZ") || a.id.localeCompare(b.id));
  return {
    schema: SCHEMA,
    generated_at: raw.generated_at,
    ipdb: cleanText(raw.ipdb),
    truncated: raw.truncated === true,
    unreachable: isInt(raw.unreachable, MAX_NODES * 10) ? raw.unreachable : 0,
    nodes,
  };
}

/** Countries holding at least one node, most nodes first. */
export function byCountry(nodes) {
  const counts = new Map();
  for (const n of nodes) if (n.country) counts.set(n.country, (counts.get(n.country) ?? 0) + 1);
  return [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/** Distinct network operators (autonomous systems). */
export function operatorCount(nodes) {
  return new Set(nodes.map((n) => n.asn).filter(Boolean)).size;
}

/** "1 d 1 h", "3 h", "12 min"; `lang` picks the day unit. */
export function formatUptime(secs, lang) {
  if (secs == null) return null;
  const day = lang === "fr" ? "j" : "d";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  if (d) return h ? `${d} ${day} ${h} h` : `${d} ${day}`;
  if (h) return `${h} h`;
  return `${Math.max(1, Math.floor(secs / 60))} min`;
}

/** Country name in `lang`, or the code when the runtime has no name. */
export function countryName(code, lang) {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// --- Dot map -------------------------------------------------------------

// Equirectangular, Antarctica cut: the map spans 84°N to 58°S.
// Duration of the census sweep across the map (network.css, .net-scan).
export const SWEEP_MS = 900;
export const MAP = { width: 1000, latTop: 84, latBottom: -58, step: 2 };
MAP.height = Math.round((MAP.width * (MAP.latTop - MAP.latBottom)) / 360);

const x = (lon) => ((lon + 180) / 360) * MAP.width;
const y = (lat) => ((MAP.latTop - lat) / (MAP.latTop - MAP.latBottom)) * MAP.height;
const round = (v) => Math.round(v * 10) / 10;

// Natural Earth features without an ISO numeric code in world-atlas.
const BY_NAME = { Kosovo: "XK", Somaliland: "SO", "N. Cyprus": "CY" };

function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A polygon is its outer ring and its holes: inside an odd number of rings.
const polygonContains = (rings, lon, lat) =>
  rings.reduce((inside, ring) => (ringContains(ring, lon, lat) ? !inside : inside), false);

function bbox(rings) {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const [lon, lat] of rings[0]) {
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}

const ringArea = (ring) =>
  Math.abs(ring.reduce((a, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return a + x1 * y2 - x2 * y1;
  }, 0)) / 2;

let cached;

/**
 * Land dots on a 2° grid, by ISO alpha-2 country, and an anchor per country
 * (the mean of the dots of its largest polygon, else that polygon's mean
 * vertex): where its count marker sits. Computed once per build.
 */
export function dotMap() {
  if (cached) return cached;
  const countries = require("i18n-iso-countries");
  const world = require("world-atlas/countries-50m.json");
  const shapes = [];
  for (const f of feature(world, world.objects.countries).features) {
    const code = f.id ? countries.numericToAlpha2(f.id) : BY_NAME[f.properties.name];
    if (!code || code === "AQ") continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const largest = polys.reduce((a, p) => (ringArea(p[0]) > ringArea(a[0]) ? p : a));
    for (const rings of polys) shapes.push({ code, rings, box: bbox(rings), main: rings === largest });
  }

  const dots = new Map();
  const mainDots = new Map();
  const half = MAP.step / 2;
  for (let lat = MAP.latTop - half; lat > MAP.latBottom; lat -= MAP.step) {
    for (let lon = -180 + half; lon < 180; lon += MAP.step) {
      const hit = shapes.find(
        (s) => lon >= s.box[0] && lon <= s.box[2] && lat >= s.box[1] && lat <= s.box[3] && polygonContains(s.rings, lon, lat),
      );
      if (!hit) continue;
      const p = [round(x(lon)), round(y(lat))];
      if (!dots.has(hit.code)) dots.set(hit.code, []);
      dots.get(hit.code).push(p);
      if (hit.main) {
        if (!mainDots.has(hit.code)) mainDots.set(hit.code, []);
        mainDots.get(hit.code).push(p);
      }
    }
  }

  const anchors = new Map();
  for (const s of shapes) {
    if (!s.main || anchors.has(s.code)) continue;
    const pts = mainDots.get(s.code) ?? s.rings[0].map(([lon, lat]) => [x(lon), y(lat)]);
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    anchors.set(s.code, [round(mx), round(my)]);
  }
  cached = { dots, anchors };
  return cached;
}

/** One SVG path drawing `points` as dots (zero-length segments, round caps). */
export const dotPath = (points) => points.map(([px, py]) => `M${px} ${py}h0`).join("");

// Markers closer than this (map units) are pushed apart along the line
// between them, so two neighbouring countries keep readable counts.
const MARKER_GAP = 56;

/** Anchors moved apart pairwise until no two are closer than MARKER_GAP. */
export function spreadMarkers(points) {
  const out = points.map(([px, py]) => [px, py]);
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j][0] - out[i][0];
        const dy = out[j][1] - out[i][1];
        const d = Math.hypot(dx, dy);
        if (d >= MARKER_GAP) continue;
        const [ux, uy] = d ? [dx / d, dy / d] : [1, 0];
        const push = (MARKER_GAP - d) / 2;
        out[i] = [out[i][0] - ux * push, out[i][1] - uy * push];
        out[j] = [out[j][0] + ux * push, out[j][1] + uy * push];
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out.map(([px, py]) => [
    round(Math.min(MAP.width - 12, Math.max(12, px))),
    round(Math.min(MAP.height - 12, Math.max(12, py))),
  ]);
}

/**
 * What the page draws: the quiet land, then each country holding nodes with
 * its dots, its anchor and its count. A country too small for a dot keeps
 * its anchor alone.
 */
export function mapLayers(countriesWithNodes) {
  const { dots, anchors } = dotMap();
  const lit = new Set(countriesWithNodes.map((c) => c.code));
  const land = [];
  for (const [code, pts] of dots) if (!lit.has(code)) land.push(...pts);
  const placed = countriesWithNodes.filter((c) => anchors.has(c.code));
  const markers = spreadMarkers(placed.map((c) => anchors.get(c.code)));
  return {
    width: MAP.width,
    height: MAP.height,
    land: dotPath(land),
    lit: placed.map((c, i) => ({
      ...c,
      path: dotPath(dots.get(c.code) ?? []),
      anchor: markers[i],
      // West to east: the order of the census sweep.
      delay: Math.round((anchors.get(c.code)[0] / MAP.width) * SWEEP_MS),
    })),
  };
}
