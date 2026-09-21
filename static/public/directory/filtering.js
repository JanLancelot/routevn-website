const normalize = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en');

export function levelOptions(filters, language) {
  if (language === 'any') {
    const options = Object.values(filters.level.optionsByLanguage).flat();
    return [...new Map(options.map((option) => [option.value, option])).values()];
  }
  return filters.level.optionsByLanguage[language] ?? [];
}

export function readFilters(search, filters) {
  const params = new URLSearchParams(search);
  const requestedLanguage = params.get('language');
  const language = filters.language.options.some((option) => option.value === requestedLanguage)
    ? requestedLanguage : filters.language.defaultValue;
  const level = params.get('level') ?? '';
  const genre = params.get('genre') ?? '';
  return {
    q: (params.get('q') ?? '').trim(),
    language,
    level: levelOptions(filters, language).some((option) => option.value === level) ? level : '',
    genre: filters.genre.options.some((option) => option.value === genre) ? genre : '',
  };
}

export function filterNovels(novels, state, filters) {
  const query = normalize(state.q);

  return novels.filter((novel) => {
    if (state.language !== 'any' && novel.language !== state.language) return false;
    if (query && ![novel.title, novel.titleOriginal, novel.titleKana, novel.titleRomanized, novel.titleEnglish?.text].some((title) => normalize(title).includes(query))) return false;
    if (state.level) {
      const levels = levelOptions(filters, novel.language);
      const selectedLevel = levels.find((option) => option.value === state.level);
      const level = levels.find((option) => option.value === novel.minimumLevel);
      if (!selectedLevel || !level || level.rank > selectedLevel.rank) return false;
    }
    if (state.genre && !novel.genres.includes(state.genre)) return false;
    return true;
  });
}

export function queryString(state, filters) {
  const params = new URLSearchParams();
  for (const key of ['q', 'language', 'level', 'genre']) {
    if (key === 'language' && state.language === filters.language.defaultValue) continue;
    const value = (state[key] ?? '').trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function resultLabel(count, copy) {
  return (count === 1 ? copy.resultOne : copy.resultMany).replace('{count}', String(count));
}
