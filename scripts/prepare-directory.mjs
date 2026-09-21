import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const write = (relative, content) => {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  if (!existsSync(target) || readFileSync(target, 'utf8') !== content) writeFileSync(target, content);
};

function isHttpsUrl(src) {
  if (typeof src !== 'string' || !src.startsWith('https://')) return false;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateCatalog(data) {
  if (!data?.site?.name || !data.copy || !data.filters || !Array.isArray(data.novels)) throw new Error('Expected site, copy, filters, and novels in data/directory.yaml.');
  for (const key of ['reportIssueUrl', 'submitNovelUrl']) {
    if (data.forms?.[key] != null && !isHttpsUrl(data.forms[key])) throw new Error(`forms.${key} must be an HTTPS form URL, or null when not configured.`);
  }
  const slugs = new Set();
  for (const key of ['language', 'genre']) {
    const values = data.filters[key]?.options?.map((option) => option.value);
    if (!values || new Set(values).size !== values.length) throw new Error(`Invalid or duplicate ${key} filter values.`);
  }
  if (!data.filters.language.options.some((option) => option.value === data.filters.language.defaultValue)) throw new Error('Unknown default language.');
  for (const { value: language } of data.filters.language.options) {
    if (language === 'any') continue;
    const levels = data.filters.level.optionsByLanguage?.[language];
    if (!Array.isArray(levels)) throw new Error(`${language}: missing level options.`);
    if (new Set(levels.map((level) => level.value)).size !== levels.length || levels.some((level) => !Number.isFinite(level.rank) || level.rank <= 0)) throw new Error(`${language}: invalid level options.`);
  }
  for (const novel of data.novels) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(novel.slug) || slugs.has(novel.slug)) throw new Error(`Invalid or duplicate slug: ${novel.slug}`);
    slugs.add(novel.slug);
    const titles = [novel.title, novel.titleOriginal, novel.titleEnglish?.text].filter(Boolean).join(' ').normalize('NFKC');
    if (/\bR[\s-]?(?:1[5-9]|[2-9]\d)(?!\d)|\b(?:1[5-9]|[2-9]\d)\s*\+|(?:1[5-9]|[2-9]\d)禁/i.test(titles)) throw new Error(`${novel.slug}: R15+ content is excluded from this directory. Remove this entry before publishing.`);
    for (const field of ['minimumAge', 'recommendedAge']) {
      if (novel[field] == null) continue;
      if (!Number.isInteger(novel[field]) || novel[field] < 0) throw new Error(`${novel.slug}: ${field} must be a nonnegative integer, or omitted when unverified.`);
      if (novel[field] >= 15) throw new Error(`${novel.slug}: R15+ content is excluded from this directory. Remove this entry before publishing.`);
    }
    for (const key of ['title', 'summary', 'synopsis', 'gameUrl']) {
      if (typeof novel[key] !== 'string' || !novel[key].trim()) throw new Error(`${novel.slug}: missing ${key}.`);
    }
    for (const key of ['titleOriginal', 'titleKana', 'titleRomanized', 'author']) {
      if (novel[key] != null && (typeof novel[key] !== 'string' || !novel[key].trim())) throw new Error(`${novel.slug}: invalid ${key}.`);
    }
    if (novel.authorUrl != null && (!novel.author || !isHttpsUrl(novel.authorUrl))) throw new Error(`${novel.slug}: authorUrl requires an author and an HTTPS profile URL.`);
    if (novel.titleEnglish != null) {
      const title = novel.titleEnglish;
      if (typeof title.text !== 'string' || !title.text.trim() || !['official', 'unofficial'].includes(title.status)) throw new Error(`${novel.slug}: titleEnglish requires text and official/unofficial status.`);
      if ((title.status === 'official' || title.sourceUrl != null) && !isHttpsUrl(title.sourceUrl)) throw new Error(`${novel.slug}: titleEnglish requires an HTTPS sourceUrl for an official title.`);
    }
    for (const key of ['gameUrl', 'vndbUrl']) {
      if (key === 'vndbUrl' && novel[key] == null) continue;
      if (typeof novel[key] !== 'string' || !novel[key].trim()) throw new Error(`${novel.slug}: invalid ${key}.`);
      if (!['http:', 'https:'].includes(new URL(novel[key]).protocol)) throw new Error(`${novel.slug}: ${key} must be an HTTP or HTTPS link.`);
    }
    if (novel.language === 'any' || !data.filters.language.options.some((option) => option.value === novel.language)) throw new Error(`${novel.slug}: unknown language.`);
    const levels = data.filters.level.optionsByLanguage[novel.language];
    if (novel.minimumLevel != null && !levels.some((option) => option.value === novel.minimumLevel)) throw new Error(`${novel.slug}: unknown minimumLevel for ${novel.language}.`);
    if (!Array.isArray(novel.genres) || !novel.genres.length || novel.genres.some((value) => !data.filters.genre.options.some((option) => option.value === value))) throw new Error(`${novel.slug}: unknown or missing genres.`);
    const cover = novel.cover;
    const localImage = /^\/public\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(svg|png|jpe?g|webp|gif)$/.test(cover?.src);
    if (!cover?.alt || (!localImage && !isHttpsUrl(cover?.src))) throw new Error(`${novel.slug}: cover must have alt text and a local /public/ image path or HTTPS image URL.`);
  }
}

export function prepare() {
  const data = yaml.load(readFileSync(path.join(root, 'data/directory.yaml'), 'utf8'));
  validateCatalog(data);
  const expectedPages = new Set(data.novels.map((novel) => `${novel.slug}.yaml`));
  mkdirSync(path.join(root, 'pages/en/directory/v'), { recursive: true });
  for (const file of readdirSync(path.join(root, 'pages/en/directory/v'))) {
    if (file.endsWith('.yaml') && !expectedPages.has(file)) rmSync(path.join(root, 'pages/en/directory/v', file));
  }
  for (const item of data.novels) {
    if (!isHttpsUrl(item.cover.src) && !existsSync(path.join(root, 'static', item.cover.src))) throw new Error(`${item.slug}: cover image is missing.`);
    const frontmatter = yaml.dump({ template: 'directory', url: `/en/v/${item.slug}/`, seoTitle: `${item.titleOriginal || item.title} · ${data.site.name}`, seoDescription: item.summary, item }, { lineWidth: -1 });
    write(`pages/en/directory/v/${item.slug}.yaml`, `---\n${frontmatter}---\n- $partial: directory/novel-detail\n  item: \${item}\n`);
  }
  const novels = data.novels.map(({ slug, title, titleOriginal, titleKana, titleRomanized, titleEnglish, language, minimumLevel, genres }) => ({
    slug, title, titleOriginal, titleKana, titleRomanized,
    titleEnglish: titleEnglish && { text: titleEnglish.text },
    language, minimumLevel, genres,
  }));
  const { searchLabel, resultOne, resultMany } = data.copy;
  write('static/public/directory/catalog-data.js', `export default ${JSON.stringify({ novels, filters: data.filters, copy: { searchLabel, resultOne, resultMany } }).replace(/</g, '\\u003c')};\n`);
  console.log(`Prepared ${data.novels.length} visual novels from data/directory.yaml.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepare();
