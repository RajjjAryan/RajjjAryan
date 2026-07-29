import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  aggregateRepositories,
  fetchAccountRepositories,
  renderSnapshot,
} from "../scripts/open-source-snapshot.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/public-repositories.json", import.meta.url)),
);

test("aggregates both accounts, deduplicates IDs, and retains account attribution", () => {
  const result = aggregateRepositories(fixture);

  assert.equal(result.repositoryCount, 2);
  assert.equal(result.totalStars, 32);
  assert.deepEqual(
    result.featured.map(({account, name}) => [account, name]),
    [
      ["Raj2503", "vintage-pacman"],
      ["RajjjAryan", "event-router"],
    ],
  );
});

test("ranks repositories by stars, then forks, then updated date", () => {
  const result = aggregateRepositories({
    RajjjAryan: [
      {
        id: 1,
        name: "fork-wins",
        html_url: "https://example.test/1",
        language: "Go",
        stargazers_count: 4,
        forks_count: 5,
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    Raj2503: [
      {
        id: 2,
        name: "newer-loses",
        html_url: "https://example.test/2",
        language: "Dart",
        stargazers_count: 4,
        forks_count: 2,
        updated_at: "2026-07-01T00:00:00Z",
      },
    ],
  });

  assert.equal(result.featured[0].name, "fork-wins");
});

test("escapes API text and declares the SVG public-only", () => {
  const svg = renderSnapshot(
    aggregateRepositories(fixture),
    new Date("2026-07-30T00:00:00Z"),
  );

  assert.match(svg, /A &lt;router&gt; &amp; queue/);
  assert.match(svg, /Public GitHub data only/);
  assert.match(svg, /<title[^>]*>Raj Aryan open-source snapshot<\/title>/);
});

test("loads every page of public repositories", async () => {
  let requestCount = 0;
  const repository = {
    id: 99,
    name: "page-two",
    html_url: "https://example.test/page-two",
    language: "Go",
    stargazers_count: 0,
    forks_count: 0,
    updated_at: "2026-07-01T00:00:00Z",
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () =>
      ++requestCount === 1
        ? Array.from({length: 100}, (_, id) => ({...repository, id}))
        : [repository],
  });

  const result = await fetchAccountRepositories("Raj2503", fetchImpl);

  assert.equal(result.length, 101);
  assert.equal(requestCount, 2);
});

test("rejects failed public GitHub requests", async () => {
  await assert.rejects(
    () =>
      fetchAccountRepositories("Raj2503", async () => ({
        ok: false,
        status: 403,
      })),
    /GitHub API request failed/,
  );
});
