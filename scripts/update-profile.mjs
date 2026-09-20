import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const escapeXml = (value) => String(value).replace(/[<>&"']/g, c => ({'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;'}[c]));

export function summarize(repositories, profile) {
  const own = repositories.filter(repo => !repo.fork);
  const counts = new Map();
  for (const repo of own) if (repo.language) counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  return {
    repos: own.length,
    stars: own.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0),
    followers: profile.followers,
    languages: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
  };
}

export function renderStats(data, date = new Date()) {
  const values = [data.repos, data.stars, data.followers];
  const labels = ['REPOSITÓRIOS', 'ESTRELAS', 'SEGUIDORES'];
  const metrics = values.map((value, index) => `<text x="${32 + index * 285}" y="105" fill="#f0f6fc" font-size="36" font-weight="700">${escapeXml(value)}</text><text x="${32 + index * 285}" y="132" fill="#a5b4cf" font-size="12" letter-spacing="2">${labels[index]}</text>`).join('');
  const langs = data.languages.length ? data.languages.map(([name, count]) => `${name} (${count})`).join('  ·  ') : 'Nenhuma linguagem identificada nos repositórios públicos.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="230" viewBox="0 0 900 230" role="img" aria-labelledby="title desc"><title id="title">GitHub em números</title><desc id="desc">${escapeXml(values.map((v, i) => `${labels[i]}: ${v}`).join(', '))}. Linguagens por repositório: ${escapeXml(langs)}</desc><rect x="1" y="1" width="898" height="228" rx="18" fill="#101827" stroke="#29364f"/><g font-family="Segoe UI,Arial,sans-serif"><text x="32" y="36" fill="#a78bfa" font-size="13" font-weight="700" letter-spacing="2">GITHUB EM NÚMEROS</text>${metrics}<path d="M32 153H868" stroke="#29364f"/><text x="32" y="183" fill="#c5d3ea" font-size="13">${escapeXml(langs)}</text><text x="32" y="210" fill="#9aabc5" font-size="11">Linguagens principais por repositório · Atualizado em ${escapeXml(date.toISOString().slice(0, 10))} (UTC)</text></g></svg>\n`;
}

export async function generate({ username, token, fetcher = fetch, directory = 'assets' }) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username || '')) throw new Error('Nome de usuário inválido.');
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'profile-readme', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  async function api(path) {
    const response = await fetcher(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GitHub API retornou ${response.status}; o cartão anterior será preservado.`);
    return response.json();
  }
  const profile = await api(`/users/${username}`);
  const repositories = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/users/${username}/repos?type=owner&per_page=100&page=${page}`);
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  const svg = renderStats(summarize(repositories, profile));
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/stats.svg`, svg);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generate({ username: process.env.PROFILE_USERNAME || 'ggustavo-lac', token: process.env.GH_TOKEN });
}
