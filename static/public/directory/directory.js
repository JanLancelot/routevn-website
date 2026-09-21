import catalog from './catalog-data.js';
import { readFilters, filterNovels, queryString, resultLabel, levelOptions } from './filtering.js';
import { connectSelect } from './select-accessibility.js';

const { novels, filters, copy } = catalog;
await Promise.all(['rtgl-input', 'rtgl-select', 'rtgl-button', 'rtgl-svg'].map((name) => customElements.whenDefined(name)));

const surface = document.querySelector('#filters');
const back = document.querySelector('#back-link');
if (back) back.setAttribute('href', `/en/directory/${queryString(readFilters(location.search, filters), filters)}`);

if (surface) {
  const search = document.querySelector('#search');
  const controls = Object.fromEntries(['language', 'level', 'genre'].map((key) => [key, document.querySelector(`#${key}`)]));
  const cards = [...document.querySelectorAll('.novel-card')];
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-state');
  const clear = document.querySelector('#clear');
  const syncSelects = [];
  let state = readFilters(location.search, filters);
  let activeLanguage;

  function refreshLevelOptions() {
    if (activeLanguage === state.language) return;
    activeLanguage = state.language;
    const options = levelOptions(filters, state.language);
    controls.level.options = [{ label: filters.level.allLabel, value: '' }, ...options];
    controls.level.disabled = !options.length;
  }

  function render() {
    const matches = new Set(filterNovels(novels, state, filters).map((novel) => novel.slug));
    const query = queryString(state, filters);
    for (const card of cards) {
      card.hidden = !matches.has(card.dataset.slug);
      card.querySelector('a').href = `/en/v/${card.dataset.slug}/${query}`;
    }
    count.textContent = resultLabel(matches.size, copy);
    empty.hidden = matches.size !== 0;
    clear.toggleAttribute('disabled', !query);
    refreshLevelOptions();
    for (const [key, control] of Object.entries(controls)) control.selectedValue = state[key];
    requestAnimationFrame(() => syncSelects.forEach((sync) => sync()));
  }

  function update(key, value) {
    const next = { ...state, [key]: value };
    if (key === 'language' && value !== state.language) next.level = '';
    state = readFilters(queryString(next, filters), filters);
    history.replaceState(null, '', `${location.pathname}${queryString(state, filters)}${location.hash}`);
    render();
  }

  function restore() {
    state = readFilters(location.search, filters);
    search.value = state.q;
    render();
  }

  const nativeInput = search.shadowRoot.querySelector('input');
  nativeInput.setAttribute('aria-label', copy.searchLabel);
  nativeInput.setAttribute('autocomplete', 'off');
  nativeInput.addEventListener('input', (event) => { if (!event.isComposing) update('q', search.value); });
  nativeInput.addEventListener('compositionend', () => update('q', search.value));
  search.removeAttribute('disabled');
  nativeInput.setAttribute('type', 'search');

  for (const [key, control] of Object.entries(controls)) {
    const config = filters[key];
    control.removeAttribute('disabled');
    control.disabled = false;
    control.options = key === 'language' ? config.options : [
      { label: config.allLabel, value: '' },
      ...(key === 'level' ? levelOptions(filters, state.language) : config.options),
    ];
    control.selectedValue = state[key];
    syncSelects.push(connectSelect(control, config.label, (value) => update(key, value)));
  }

  function reset() {
    state = readFilters('', filters);
    search.value = '';
    history.replaceState(null, '', location.pathname);
    render();
    search.focus();
  }
  clear.addEventListener('click', () => { if (!clear.hasAttribute('disabled')) reset(); });
  document.querySelector('#empty-clear').addEventListener('click', reset);
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  restore();
}
