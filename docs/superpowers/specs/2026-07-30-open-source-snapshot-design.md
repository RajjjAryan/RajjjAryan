# Open-source snapshot design

## Purpose

Replace the professional profile's incomplete contribution metric and Pac-Man graph with a concise, professional view of Raj Aryan's public open-source work across `RajjjAryan` and `Raj2503`.

The widget must not claim to represent private activity, all-time contribution totals, or fork-only contribution credit.

## User-facing design

The profile README will contain one section, **Open-source snapshot**, rendered as `open-source-snapshot.svg`.

The SVG uses a restrained dark infrastructure-inspired layout and shows:

- The count of public repositories across both accounts.
- The aggregate stars received by those public repositories.
- A clearly labelled public-repository language mix.
- Four selected public repository cards with repository name, account, primary language, stars, and forks.
- A generated-at date and a small public-data-only disclosure.

Repository cards are selected from the public repositories returned by GitHub's API. Their score prioritises stars, then forks, then recent update time. The originating account remains visible on each card.

## Architecture and data flow

`scripts/generate-open-source-snapshot.mjs` will use Node's standard library to request the public repositories endpoints for `RajjjAryan` and `Raj2503`.

The generator will:

1. Fetch paginated public repository lists for both accounts.
2. Normalise and combine records, deduplicating by repository ID.
3. Calculate public-repository count, total stars, language counts, and the four ranked cards.
4. Escape all API-derived text before embedding it in SVG.
5. Write a complete, accessible SVG with a descriptive title and description.

`.github/workflows/update-open-source-snapshot.yml` will run daily and on manual dispatch. It checks out the profile repository, runs the generator, and commits only an updated SVG. It needs no personal access token because it reads only public data; the repository-scoped Actions token is used only to commit the generated file.

## Failure handling

If fetching or generation fails, the workflow fails before writing the output. The committed SVG therefore remains the last valid render. No empty or partial snapshot is published.

The README remains readable even if the image cannot load: its alt text identifies the widget and links visitors to both public GitHub profiles.

## Content removal

The implementation removes:

- The `GitHub activity` Metrics SVG embed and `github-metrics.svg` asset.
- The Pac-Man contribution section.
- `.github/workflows/metrics.yml`.
- `.github/workflows/update-arcade-graph.yml`.

The generated `output` branch is not required by the replacement and is left untouched; it can be deleted separately if desired, once any external references are confirmed absent.

## Validation

Fixture-based tests will cover pagination aggregation, ranking ties, XML escaping, account attribution, and failed fetch behaviour. The workflow and generated SVG will be checked for valid YAML/XML and no private repository names, private contribution totals, or tokens.

After implementation, the profile README will be inspected in GitHub's rendered view and the generator will be run locally with fixtures and live public data.
