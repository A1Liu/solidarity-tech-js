/**
 * Refresh the vendored OpenAPI document from ReadMe.
 *
 * `scripts/resources.ts` derives the resource inventory, entity schemas, and
 * declared enums from `.api/apis/solidarity-tech/openapi.json`, which makes that
 * document load-bearing — and a snapshot nobody can refresh is hand-maintenance
 * moved rather than deleted. This is the refresh. Any diff it produces is a
 * genuine upstream change.
 *
 * The `api` installer cannot fetch a document on its own: it generates a whole
 * SDK (~9,700 files, including a nested `node_modules`) and adds itself to the
 * caller's `package.json`. This repo vendors two files and hand-writes its own
 * client, so the install runs in a temporary directory and only the two vendored
 * files are copied back.
 *
 *   bun run update
 */
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

/** What `.api/api.json` records as the source of the vendored document. */
const source = "@solidarity-tech/v1.0#lfqy225lyhwzhmj";

/** Everything else the installer emits is generated SDK this repo does not use. */
const vendored = ["api.json", "apis/solidarity-tech/openapi.json"];

const workspace = await mkdtemp(join(tmpdir(), "solidarity-api-"));
try {
  // The installer resolves `.api` against the working directory and edits the
  // package.json it finds there, so it gets one of its own.
  await writeFile(
    join(workspace, "package.json"),
    `${JSON.stringify({ name: "openapi-refresh", version: "0.0.0" }, null, 2)}\n`,
  );
  await $`bunx api@6 install --lang ts --yes ${source}`.cwd(workspace);

  for (const file of vendored)
    await cp(join(workspace, ".api", file), join(".api", file));
  console.log(`\nRefreshed ${vendored.map((f) => `.api/${f}`).join(" and ")}`);
  console.log("Any diff is a genuine upstream change — review it.\n");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
