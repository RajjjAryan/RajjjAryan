# Open-source Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the professional profile's Metrics and Pac-Man visuals with one reliable SVG showing verified public open-source work from RajjjAryan and Raj2503.

**Architecture:** A dependency-free Node module fetches public repository data from both accounts, aggregates and ranks it, then renders an accessible SVG. A scheduled GitHub Actions workflow regenerates it; an atomic write ensures an API failure leaves the previous valid file in place.

**Tech Stack:** Node.js built-in fetch, node:test, node:assert/strict, GitHub REST API, GitHub Actions, SVG, Markdown.

---

## File structure

- scripts/open-source-snapshot.mjs — public API reader, normaliser, ranker, XML escaper, and SVG renderer.
- scripts/generate-open-source-snapshot.mjs — atomic CLI writer.
- test/fixtures/public-repositories.json — API fixture rows for both accounts.
- test/open-source-snapshot.test.mjs — fixture-based behaviour tests.
- .github/workflows/update-open-source-snapshot.yml — daily/manual generator and generated-file commit.
- open-source-snapshot.svg — committed asset shown by README.md.

### Task 1: Define the generator behaviour with fixtures and failing tests

**Files:**
- Create: test/fixtures/public-repositories.json
- Create: test/open-source-snapshot.test.mjs
- Create: scripts/open-source-snapshot.mjs

- [ ] **Step 1: Add representative public API rows**

~~~json
{
  "RajjjAryan": [
    {"id": 11, "name": "event-router", "full_name": "RajjjAryan/event-router", "html_url": "https://github.com/RajjjAryan/event-router", "description": "A <router> & queue", "language": "Go", "stargazers_count": 8, "forks_count": 4, "updated_at": "2026-07-29T00:00:00Z"}
  ],
  "Raj2503": [
    {"id": 22, "name": "vintage-pacman", "full_name": "Raj2503/vintage-pacman", "html_url": "https://github.com/Raj2503/vintage-pacman", "description": "Flutter arcade", "language": "Dart", "stargazers_count": 24, "forks_count": 10, "updated_at": "2026-07-28T00:00:00Z"},
    {"id": 11, "name": "duplicate-id", "full_name": "Raj2503/duplicate-id", "html_url": "https://github.com/Raj2503/duplicate-id", "language": "Go", "stargazers_count": 1, "forks_count": 0, "updated_at": "2026-07-20T00:00:00Z"}
  ]
}
~~~

- [ ] **Step 2: Write the failing test module**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {aggregateRepositories, fetchAccountRepositories, renderSnapshot} from "../scripts/open-source-snapshot.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/public-repositories.json", import.meta.url)));

test("aggregates both accounts, deduplicates ids, and retains account attribution", () => {
  const result = aggregateRepositories(fixture);
  assert.equal(result.repositoryCount, 2);
  assert.equal(result.totalStars, 32);
  assert.deepEqual(result.featured.map(({account, name}) => [account, name]), [["Raj2503", "vintage-pacman"], ["RajjjAryan", "event-router"]]);
});

test("ranks by stars, then forks, then updated date", () => {
  const result = aggregateRepositories({RajjjAryan: [{id: 1, name: "fork-wins", html_url: "https://example.test/1", language: "Go", stargazers_count: 4, forks_count: 5, updated_at: "2026-01-01T00:00:00Z"}], Raj2503: [{id: 2, name: "newer-loses", html_url: "https://example.test/2", language: "Dart", stargazers_count: 4, forks_count: 2, updated_at: "2026-07-01T00:00:00Z"}]});
  assert.equal(result.featured[0].name, "fork-wins");
});

test("escapes API text and declares public-only data", () => {
  const svg = renderSnapshot(aggregateRepositories(fixture), new Date("2026-07-30T00:00:00Z"));
  assert.match(svg, /A &lt;router&gt; &amp; queue/);
  assert.match(svg, /Public GitHub data only/);
  assert.match(svg, /<title>Raj Aryan open-source snapshot<\/title>/);
});

test("rejects a failed public GitHub request", async () => {
  await assert.rejects(() => fetchAccountRepositories("Raj2503", async () => ({ok: false, status: 403})), /GitHub API request failed/);
});

test("loads every page of public repositories", async () => {
  let requestCount = 0;
  const page = {id: 99, name: "page-two", html_url: "https://example.test/page-two", language: "Go", stargazers_count: 0, forks_count: 0, updated_at: "2026-07-01T00:00:00Z"};
  const fetchImpl = async () => ({ok: true, json: async () => ++requestCount === 1 ? Array.from({length: 100}, (_, id) => ({...page, id})) : [page]});
  assert.equal((await fetchAccountRepositories("Raj2503", fetchImpl)).length, 101);
  assert.equal(requestCount, 2);
});
~~~

- [ ] **Step 3: Confirm the test fails before implementation**

Run: node --test test/open-source-snapshot.test.mjs

Expected: FAIL because the generator modules do not exist.

- [ ] **Step 4: Commit the test contract**

~~~bash
git add test/fixtures/public-repositories.json test/open-source-snapshot.test.mjs
git commit -m "test: define open-source snapshot behaviour"
~~~

### Task 2: Implement public data normalisation, ranking, and rendering

**Files:**
- Modify: scripts/open-source-snapshot.mjs
- Test: test/open-source-snapshot.test.mjs

- [ ] **Step 1: Implement the public API reader and aggregation functions**

~~~js
export const ACCOUNTS = ["RajjjAryan", "Raj2503"];

const escapeXml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", "\"": "&quot;"}[character]));

export async function fetchAccountRepositories(account, fetchImpl = fetch) {
  const repositories = [];
  for (let page = 1; ; page++) {
    const url = new URL("https://api.github.com/users/" + account + "/repos");
    url.search = new URLSearchParams({per_page: "100", page: String(page), sort: "updated", direction: "desc", type: "owner"});
    const response = await fetchImpl(url, {headers: {Accept: "application/vnd.github+json", "User-Agent": "rajjjaryan-profile-snapshot"}});
    if (!response.ok) throw new Error("GitHub API request failed for " + account + ": " + response.status);
    const batch = await response.json();
    repositories.push(...batch);
    if (batch.length < 100) return repositories;
  }
}

export function aggregateRepositories(repositoriesByAccount) {
  const seen = new Set();
  const repositories = Object.entries(repositoriesByAccount).flatMap(([account, items]) => items.map(item => ({...item, account}))).filter(item => !seen.has(item.id) && seen.add(item.id));
  const featured = [...repositories].sort((left, right) => right.stargazers_count - left.stargazers_count || right.forks_count - left.forks_count || Date.parse(right.updated_at) - Date.parse(left.updated_at)).slice(0, 4);
  const languages = repositories.reduce((counts, item) => item.language ? {...counts, [item.language]: (counts[item.language] || 0) + 1} : counts, {});
  return {repositories, featured, languages, repositoryCount: repositories.length, totalStars: repositories.reduce((sum, item) => sum + item.stargazers_count, 0)};
}
~~~

- [ ] **Step 2: Implement an accessible SVG renderer**

~~~js
export function renderSnapshot(snapshot, now = new Date()) {
  const cards = snapshot.featured.map((repository, index) => {
    const x = 24 + (index % 2) * 426;
    const y = 176 + Math.floor(index / 2) * 104;
    return "<a href=\"" + escapeXml(repository.html_url) + "\"><g transform=\"translate(" + x + " " + y + ")\"><rect width=\"402\" height=\"82\" rx=\"10\" fill=\"#111f36\" stroke=\"#2a3c57\"/><text x=\"16\" y=\"27\" fill=\"#f8fafc\" font-size=\"16\" font-weight=\"700\">" + escapeXml(repository.name) + "</text><text x=\"386\" y=\"27\" fill=\"#67e8f9\" font-size=\"11\" text-anchor=\"end\">" + escapeXml(repository.account) + "</text><text x=\"16\" y=\"55\" fill=\"#a9b8ca\" font-size=\"12\">" + escapeXml(repository.language || "Unspecified") + " · ★ " + repository.stargazers_count + " · forks " + repository.forks_count + "</text></g></a>";
  }).join("");
  const languageMix = Object.entries(snapshot.languages).sort(([, left], [, right]) => right - left).slice(0, 4).map(([language, count]) => escapeXml(language) + " " + count).join(" · ") || "No language metadata";
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"900\" height=\"420\" role=\"img\" aria-labelledby=\"title description\"><title id=\"title\">Raj Aryan open-source snapshot</title><desc id=\"description\">Verified public repositories from RajjjAryan and Raj2503.</desc><rect width=\"900\" height=\"420\" rx=\"14\" fill=\"#0b1220\"/><text x=\"24\" y=\"35\" fill=\"#7dd3fc\" font-size=\"11\">RAJ ARYAN / PUBLIC GITHUB WORK</text><text x=\"24\" y=\"69\" fill=\"#f8fafc\" font-size=\"28\" font-weight=\"700\">Open-source snapshot</text><text x=\"24\" y=\"102\" fill=\"#93a4ba\" font-size=\"12\">" + snapshot.repositoryCount + " public projects · stars " + snapshot.totalStars + " · " + languageMix + "</text>" + cards + "<text x=\"24\" y=\"394\" fill=\"#93a4ba\" font-size=\"11\">Public GitHub data only · Updated " + now.toISOString().slice(0, 10) + "</text></svg>";
}
~~~

- [ ] **Step 3: Run tests and validate fixture SVG XML**

Run: node --test test/open-source-snapshot.test.mjs

Expected: all tests PASS.

Run: node --input-type=module -e 'import {readFile,writeFile} from "node:fs/promises"; import {aggregateRepositories,renderSnapshot} from "./scripts/open-source-snapshot.mjs"; const data=JSON.parse(await readFile("test/fixtures/public-repositories.json")); await writeFile("/tmp/open-source-snapshot.svg",renderSnapshot(aggregateRepositories(data)))' && xmllint --noout /tmp/open-source-snapshot.svg

Expected: XML validation is silent.

- [ ] **Step 4: Commit the pure generator**

~~~bash
git add scripts/open-source-snapshot.mjs test/open-source-snapshot.test.mjs
git commit -m "feat: render public open-source snapshot"
~~~

### Task 3: Add atomic CLI generation and a daily refresh workflow

**Files:**
- Create: scripts/generate-open-source-snapshot.mjs
- Create: .github/workflows/update-open-source-snapshot.yml
- Modify: test/open-source-snapshot.test.mjs

- [ ] **Step 1: Add the failing atomic-write test to the existing test module**

~~~js
import {rm, writeFile} from "node:fs/promises";
import {writeSnapshot} from "../scripts/generate-open-source-snapshot.mjs";

test("preserves an existing asset when a required account fetch fails", async () => {
  const output = new URL("./temporary-snapshot.svg", import.meta.url);
  await writeFile(output, "previous-valid-svg");
  await assert.rejects(() => writeSnapshot({output, fetchImpl: async () => ({ok: false, status: 500})}), /GitHub API request failed/);
  assert.equal(await readFile(output, "utf8"), "previous-valid-svg");
  await rm(output);
});
~~~

Run: node --test test/open-source-snapshot.test.mjs

Expected: FAIL because scripts/generate-open-source-snapshot.mjs does not exist.

- [ ] **Step 2: Implement atomic writing after both accounts load**

~~~js
import {rename, writeFile} from "node:fs/promises";
import {ACCOUNTS, aggregateRepositories, fetchAccountRepositories, renderSnapshot} from "./open-source-snapshot.mjs";

export async function writeSnapshot({output = new URL("../open-source-snapshot.svg", import.meta.url), fetchImpl = fetch, now = new Date()} = {}) {
  const entries = await Promise.all(ACCOUNTS.map(async account => [account, await fetchAccountRepositories(account, fetchImpl)]));
  const svg = renderSnapshot(aggregateRepositories(Object.fromEntries(entries)), now);
  const temporary = new URL(output.pathname + ".tmp", output);
  await writeFile(temporary, svg);
  await rename(temporary, output);
  return svg;
}

if (process.argv[1] === new URL(import.meta.url).pathname) await writeSnapshot();
~~~

- [ ] **Step 3: Create the workflow with test-before-generate ordering**

~~~yaml
name: Update open-source snapshot

on:
  schedule:
    - cron: "23 6 * * *"
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - "scripts/**"
      - ".github/workflows/update-open-source-snapshot.yml"

permissions:
  contents: write

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node --test test/open-source-snapshot.test.mjs
      - run: node scripts/generate-open-source-snapshot.mjs
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add open-source-snapshot.svg
          git diff --cached --quiet || git commit -m "chore: refresh open-source snapshot [skip ci]"
          git push
~~~

- [ ] **Step 4: Run local generation and validate output**

Run: node --test test/open-source-snapshot.test.mjs && node scripts/generate-open-source-snapshot.mjs && xmllint --noout open-source-snapshot.svg

Expected: tests PASS, generation succeeds, and XML validation is silent.

- [ ] **Step 5: Commit the CLI, workflow, tests, and generated asset**

~~~bash
git add scripts/generate-open-source-snapshot.mjs .github/workflows/update-open-source-snapshot.yml test/open-source-snapshot.test.mjs open-source-snapshot.svg
git commit -m "feat: automate open-source snapshot refresh"
~~~

### Task 4: Replace profile visuals and delete obsolete contribution tooling

**Files:**
- Modify: README.md
- Delete: github-metrics.svg
- Delete: .github/workflows/metrics.yml
- Delete: .github/workflows/update-arcade-graph.yml

- [ ] **Step 1: Replace the old sections with the accurately scoped embed**

~~~md
## Open-source snapshot

<a href="https://github.com/RajjjAryan"><img src="./open-source-snapshot.svg" alt="Open-source snapshot showing Raj Aryan's verified public GitHub repositories across RajjjAryan and Raj2503" width="900" /></a>

<sub>Public GitHub data from [RajjjAryan](https://github.com/RajjjAryan) and [Raj2503](https://github.com/Raj2503). Private activity and contribution totals are intentionally not shown.</sub>
~~~

- [ ] **Step 2: Remove stale assets and workflows**

Run: git rm github-metrics.svg .github/workflows/metrics.yml .github/workflows/update-arcade-graph.yml

Expected: Git reports three deleted paths.

- [ ] **Step 3: Verify no stale contribution widget references remain**

Run: rg -n "github-metrics|pacman|ACCESS_TOKEN|contribution calendar" README.md .github scripts test || true

Expected: no README or active workflow references to removed contribution tooling.

Run: rg -n "private|restricted" open-source-snapshot.svg

Expected: only the intentional public-data disclosure; no private repository names or contribution totals.

- [ ] **Step 4: Commit the professional profile replacement**

~~~bash
git add README.md open-source-snapshot.svg
git commit -m "docs: feature public open-source snapshot"
~~~

### Task 5: Final verification and delivery

**Files:**
- Verify: README.md
- Verify: open-source-snapshot.svg
- Verify: .github/workflows/update-open-source-snapshot.yml

- [ ] **Step 1: Run the complete quality suite**

Run: node --test test/open-source-snapshot.test.mjs && node scripts/generate-open-source-snapshot.mjs && xmllint --noout open-source-snapshot.svg && git diff --check && git status --short

Expected: tests pass, XML validation is silent, diff check is silent, and no unexpected generated changes remain.

- [ ] **Step 2: Inspect the embed and SVG dimensions**

Run: rg -n -C 3 "Open-source snapshot" README.md && rg -o 'width="900" height="420"' open-source-snapshot.svg

Expected: one README embed and one 900 by 420 SVG declaration.

- [ ] **Step 3: Push and manually validate the new workflow**

Run: git push origin main && gh workflow run update-open-source-snapshot.yml --repo RajjjAryan/RajjjAryan && gh run list --repo RajjjAryan/RajjjAryan --workflow update-open-source-snapshot.yml --limit 1

Expected: the remote branch advances and the manual run completes successfully, changing only open-source-snapshot.svg when public data changes.

## Self-review

- Spec coverage: Tasks 1–3 implement the public-only cross-account SVG, failure handling, tests, and daily/manual refresh. Task 4 removes Metrics and Pac-Man. Task 5 validates locally and remotely.
- Placeholder scan: no incomplete markers or unspecified validation steps remain.
- Type consistency: aggregateRepositories, fetchAccountRepositories, renderSnapshot, and writeSnapshot are defined before later tasks import or execute them.
