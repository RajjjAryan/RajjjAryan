export const ACCOUNTS = ["RajjjAryan", "Raj2503"];

const escapeXml = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&apos;",
        '"': "&quot;",
      })[character],
  );

export async function fetchAccountRepositories(account, fetchImpl = fetch) {
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/users/${account}/repos`);
    url.search = new URLSearchParams({
      per_page: "100",
      page: String(page),
      sort: "updated",
      direction: "desc",
      type: "owner",
    });

    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "rajjjaryan-profile-snapshot",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed for ${account}: ${response.status}`,
      );
    }

    const batch = await response.json();
    repositories.push(...batch);

    if (batch.length < 100) {
      return repositories;
    }
  }
}

export function aggregateRepositories(repositoriesByAccount) {
  const seenRepositoryIds = new Set();
  const repositories = Object.entries(repositoriesByAccount)
    .flatMap(([account, accountRepositories]) =>
      accountRepositories.map((repository) => ({...repository, account})),
    )
    .filter((repository) => {
      if (seenRepositoryIds.has(repository.id)) {
        return false;
      }

      seenRepositoryIds.add(repository.id);
      return true;
    });

  const featured = [...repositories]
    .sort(
      (left, right) =>
        right.stargazers_count - left.stargazers_count ||
        right.forks_count - left.forks_count ||
        Date.parse(right.updated_at) - Date.parse(left.updated_at),
    )
    .slice(0, 4);

  const languages = repositories.reduce((counts, repository) => {
    if (!repository.language) {
      return counts;
    }

    return {
      ...counts,
      [repository.language]: (counts[repository.language] ?? 0) + 1,
    };
  }, {});

  return {
    repositories,
    featured,
    languages,
    repositoryCount: repositories.length,
    totalStars: repositories.reduce(
      (total, repository) => total + repository.stargazers_count,
      0,
    ),
  };
}

function renderCards(repositories) {
  if (repositories.length === 0) {
    return '<text x="24" y="196" fill="#a9b8ca" font-size="14">No public repositories are currently available.</text>';
  }

  return repositories
    .map((repository, index) => {
      const x = 24 + (index % 2) * 426;
      const y = 156 + Math.floor(index / 2) * 104;
      const description = repository.description
        ? `<title>${escapeXml(repository.description)}</title>`
        : "";

      return `<a href="${escapeXml(repository.html_url)}"><g transform="translate(${x} ${y})">${description}<rect width="402" height="82" rx="10" fill="#111f36" stroke="#2a3c57"/><text x="16" y="29" fill="#f8fafc" font-size="16" font-weight="700">${escapeXml(repository.name)}</text><text x="386" y="29" fill="#67e8f9" font-size="11" text-anchor="end">${escapeXml(repository.account)}</text><text x="16" y="57" fill="#a9b8ca" font-size="12">${escapeXml(repository.language ?? "Unspecified")} · ★ ${repository.stargazers_count} · forks ${repository.forks_count}</text></g></a>`;
    })
    .join("");
}

export function renderSnapshot(snapshot, now = new Date()) {
  const languageMix =
    Object.entries(snapshot.languages)
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 4)
      .map(([language, count]) => `${escapeXml(language)} ${count}`)
      .join(" · ") || "No language metadata";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420" role="img" aria-labelledby="title description">
  <title id="title">Raj Aryan open-source snapshot</title>
  <desc id="description">Verified public repositories from RajjjAryan and Raj2503.</desc>
  <rect width="900" height="420" rx="14" fill="#0b1220"/>
  <text x="24" y="35" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="11" letter-spacing="1.5">RAJ ARYAN / PUBLIC GITHUB WORK</text>
  <text x="24" y="72" fill="#f8fafc" font-family="Arial, sans-serif" font-size="28" font-weight="700">Open-source snapshot</text>
  <text x="24" y="108" fill="#93a4ba" font-family="Arial, sans-serif" font-size="12">${snapshot.repositoryCount} public projects · ★ ${snapshot.totalStars} stars · ${languageMix}</text>
  <line x1="24" x2="876" y1="132" y2="132" stroke="#25344d"/>
  ${renderCards(snapshot.featured)}
  <line x1="24" x2="876" y1="380" y2="380" stroke="#25344d"/>
  <text x="24" y="402" fill="#93a4ba" font-family="Arial, sans-serif" font-size="11">Public GitHub data only · Updated ${now.toISOString().slice(0, 10)}</text>
</svg>`;
}
