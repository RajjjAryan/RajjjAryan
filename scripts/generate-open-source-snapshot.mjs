import {rename, writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {
  ACCOUNTS,
  aggregateRepositories,
  fetchAccountRepositories,
  renderSnapshot,
} from "./open-source-snapshot.mjs";

export async function writeSnapshot({
  output = new URL("../open-source-snapshot.svg", import.meta.url),
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const repositoryEntries = await Promise.all(
    ACCOUNTS.map(async (account) => [
      account,
      await fetchAccountRepositories(account, fetchImpl),
    ]),
  );
  const svg = renderSnapshot(
    aggregateRepositories(Object.fromEntries(repositoryEntries)),
    now,
  );
  const outputUrl = new URL(output);
  const temporaryUrl = new URL(outputUrl);
  temporaryUrl.pathname = `${outputUrl.pathname}.tmp`;

  await writeFile(temporaryUrl, svg);
  await rename(temporaryUrl, outputUrl);

  return svg;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await writeSnapshot();
}
