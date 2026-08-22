/**
 * Fail-closed scrubbing for captured API responses — the mechanism behind
 * ADR 0001.
 *
 * Every string is replaced with a stand-in unless the document declares its key
 * as a closed set and the value is one of that set's members, so a field nobody
 * anticipated is scrubbed by default rather than by memory. The stand-in's shape
 * is inferred from the value rather than the key: an
 * email-shaped string becomes an email-shaped stand-in and an ISO timestamp
 * keeps its precision and zone, so identity is destroyed while the format a
 * schema checks survives.
 *
 * A string holding an encoded JSON document is decoded, scrubbed, and
 * re-encoded. Flattening one to a stand-in would still parse green — the event
 * schemas transform unparseable `location_data.components` to null — leaving a
 * fixture that no longer exercises the transform it exists to pin.
 *
 * Stand-ins come from a seeded generator, never from the value they replace, so
 * no stand-in can be linked back to the record it came from.
 */
import { faker } from "@faker-js/faker";
import { declaredEnums } from "./resources";

const scrubSeed = 20260812;

/**
 * Whether a string is one of a closed set the document declares for its key —
 * the only reason a string survives verbatim.
 *
 * Both conditions are required, which makes this strictly narrower than the
 * hand-kept key list it replaces: a declared-enum key still scrubs when it holds
 * anything but a declared member, and no exemption can be added by memory. The
 * document declares five such properties; the hand-kept list had reached two,
 * each added only after a schema failure had already been shipped.
 */
export function isDeclaredEnumValue(key: string, value: string): boolean {
  return declaredEnums.get(key)?.has(value) ?? false;
}

// The fail-closed rule covers strings. Numbers cannot be replaced wholesale —
// ids, counts, and pagination are structural — so only coordinates are.
const latitudeKeys = new Set(["lat", "latitude"]);
const longitudeKeys = new Set(["lng", "longitude"]);

const isoTimestamp =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const emailAddress = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const httpUrl = /^https?:\/\/\S+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wktPoint = /^POINT \(-?[\d.]+ -?[\d.]+\)$/;
const digitString = /^\d+$/;
const phoneNumber = /^\+?[\d\s().-]{7,}$/;

/** A generated timestamp with the same precision and zone suffix as `value`. */
function timestampStandIn(value: string): string {
  const generated = faker.date.past().toISOString();
  const zone = value.match(/(Z|[+-]\d{2}:\d{2})$/)?.[0] ?? "";
  const base = value.includes(".")
    ? generated.slice(0, 23)
    : generated.slice(0, 19);
  return base + zone;
}

function standInFor(value: string): string {
  if (isoTimestamp.test(value)) return timestampStandIn(value);
  if (isoDate.test(value)) return faker.date.past().toISOString().slice(0, 10);
  if (emailAddress.test(value)) return faker.internet.email();
  if (httpUrl.test(value)) return faker.internet.url();
  if (uuid.test(value)) return faker.string.uuid();
  if (wktPoint.test(value))
    return `POINT (${faker.location.longitude()} ${faker.location.latitude()})`;
  if (digitString.test(value)) return faker.string.numeric(value.length);
  if (phoneNumber.test(value)) return faker.phone.number();
  return faker.lorem.words(Math.min(value.split(/\s+/).length, 8));
}

type EncodedJson = { encoded: true; document: unknown } | { encoded: false };

function decodeJson(value: string): EncodedJson {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("["))
    return { encoded: false };
  try {
    return { encoded: true, document: JSON.parse(trimmed) };
  } catch {
    return { encoded: false };
  }
}

/** Contains the `any` the `Object.entries` overload produces for a bare object. */
function entriesOf(value: object): [string, unknown][] {
  return Object.entries(value);
}

function scrubValue(value: unknown, key: string): unknown {
  if (typeof value === "string") {
    if (value === "" || isDeclaredEnumValue(key, value)) return value;
    const decoded = decodeJson(value);
    return decoded.encoded
      ? JSON.stringify(scrubValue(decoded.document, key))
      : standInFor(value);
  }
  if (typeof value === "number") {
    if (latitudeKeys.has(key)) return faker.location.latitude();
    if (longitudeKeys.has(key)) return faker.location.longitude();
    return value;
  }
  if (Array.isArray(value))
    return value.map((element) => scrubValue(element, key));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      entriesOf(value).map(([childKey, child]) => [
        childKey,
        scrubValue(child, childKey),
      ]),
    );
  return value;
}

/**
 * Scrub a whole response body. Deterministic: the same body always scrubs to the
 * same fixture, so a re-capture of unchanged data produces no diff.
 */
export function scrubResponse(body: unknown): unknown {
  faker.seed(scrubSeed);
  return scrubValue(body, "");
}

/**
 * Paths where a non-empty string survived scrubbing under an unexempted key —
 * the mechanical check that ADR 0001's absolute rule held for this body. Every
 * string returned is a path built from key names, never a field value.
 */
export function findRetainedStrings(
  raw: unknown,
  scrubbed: unknown,
  path = "",
  key = "",
): string[] {
  if (typeof raw === "string") {
    if (raw === "" || isDeclaredEnumValue(key, raw)) return [];
    const rawDocument = decodeJson(raw);
    if (rawDocument.encoded && typeof scrubbed === "string") {
      const scrubbedDocument = decodeJson(scrubbed);
      if (scrubbedDocument.encoded)
        return findRetainedStrings(
          rawDocument.document,
          scrubbedDocument.document,
          path,
          key,
        );
    }
    return raw === scrubbed ? [path || "(root)"] : [];
  }
  if (Array.isArray(raw) && Array.isArray(scrubbed))
    return raw.flatMap((element, index) =>
      findRetainedStrings(element, scrubbed[index], `${path}[${index}]`, key),
    );
  if (
    raw !== null &&
    typeof raw === "object" &&
    scrubbed !== null &&
    typeof scrubbed === "object"
  ) {
    const scrubbedRecord = Object.fromEntries(entriesOf(scrubbed));
    return entriesOf(raw).flatMap(([childKey, child]) =>
      findRetainedStrings(
        child,
        scrubbedRecord[childKey],
        path ? `${path}.${childKey}` : childKey,
        childKey,
      ),
    );
  }
  return [];
}
