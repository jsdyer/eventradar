import { addDays, calendarFile, dayInZone, importCalendar, normalizeFeed, regions } from './model.mjs';

import { provinces } from './regions.mjs';

const get = id => document.getElementById(id);
const status = get('feed-status');
const results = get('events');
const when = get('when');
const query = get('event-query');
const category = get('category');
const refresh = get('refresh');
const cityPicker = get('region');
const importStatus = get('import-status');
const plan = new Map();
const imports = new Map();
const feeds = new Map();
let region = 'vancouver';
let pageLimit = 25;

function element(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function button(text, callback, cls = 'pill') {
  const node = element('button', text, cls);
  node.type = 'button';
  node.addEventListener('click', callback);
  return node;
}

function link(text, url) {
  const node = element('a', text);
  node.href = url;
  if (url.startsWith('https:')) {
    node.rel = 'noopener noreferrer';
    node.target = '_blank';
  }
  return node;
}

function human(value) {
  return value.replace(/-/g, ' ').replace(/^./, first => first.toUpperCase());
}

function setStatus(text, error = false, more) {
  status.textContent = text;
  status.dataset.error = String(error);
  if (more) status.append(' ', more);
}

function parseDay(isoDay) {
  return Date.parse(isoDay + 'T12:00:00Z');
}

const readableDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
const clockFormatters = new Map();
function formatTime(epoch, zone, withZone = false) {
  const key = zone + ':' + withZone;
  if (!clockFormatters.has(key)) clockFormatters.set(key, new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, hour: 'numeric', minute: '2-digit', timeZoneName: withZone ? 'short' : undefined,
  }));
  return clockFormatters.get(key).format(epoch);
}

function timeText(event) {
  if (event.start == null) return event.allDay ? 'All day' : 'Time unlisted';
  return formatTime(event.start, event.zone, true);
}

function planButton(event, control) {
  const selected = plan.has(event.id);
  control.textContent = selected ? 'Remove' : 'Add to plans';
  control.setAttribute('aria-label', (selected ? 'Remove ' : 'Add ') + event.title + (selected ? ' from plans' : ' to plans'));
}

function eventCard(event) {
  const card = element('article', undefined, 'card');
  const whenBox = element('div', undefined, 'when-box');
  const time = element('time', readableDate.format(parseDay(event.day)));
  time.dateTime = event.start == null ? event.day : new Date(event.start).toISOString();
  whenBox.append(time, element('span', timeText(event), 'fine'));

  const info = element('div');
  info.append(element('h3', event.title));
  const venue = element('p', [event.venue, event.category && human(event.category), event.place].filter(Boolean).join(' · '), 'event-meta');
  if (venue.textContent) info.append(venue);
  const badges = [];
  if (!['scheduled', 'confirmed'].includes(event.status)) badges.push(human(event.status));
  if (event.confidence === 'single-source') badges.push('Single source');
  if (badges.length) info.append(element('span', badges.join(' · '), 'badge'));

  const actions = element('div', undefined, 'event-actions');
  if (event.tickets && event.url !== event.tickets) actions.append(link('Organizer / tickets ↗', event.tickets));
  if (event.url) actions.append(link(event.source + ' ↗', event.url));
  const control = button('', () => {
    if (plan.has(event.id)) plan.delete(event.id);
    else plan.set(event.id, event);
    planButton(event, control);
    renderPlan();
  });
  planButton(event, control);
  control.disabled = ['cancelled', 'canceled', 'postponed'].includes(event.status) && !plan.has(event.id);
  actions.append(control);
  card.append(whenBox, info, actions);
  return card;
}

function compare(a, b) {
  return a.day.localeCompare(b.day) || (a.start ?? Infinity) - (b.start ?? Infinity) || a.title.localeCompare(b.title);
}

function renderPlan() {
  const events = [...plan.values()].sort(compare);
  get('download').disabled = !events.length;
  const list = get('plan-list');
  list.replaceChildren(...events.map(event => {
    const row = element('li', readableDate.format(parseDay(event.day)) + ' · ' + event.title + ' · ' + timeText(event));
    const remove = button('Remove', () => {
      plan.delete(event.id);
      renderPlan();
      render();
      get('plan-heading').focus();
    });
    remove.setAttribute('aria-label', 'Remove ' + event.title + ' from plans');
    row.append(remove);
    return row;
  }));
}

function filterEvents(events) {
  const regionZone = regions[region]?.zone;
  const terms = query.value.toLowerCase().trim().split(/\s+/);
  const selectedCategory = category.value;
  const now = Date.now();
  const dates = new Map();
  return events.filter(event => {
    const zone = regionZone || event.zone;
    if (!dates.has(zone)) {
      const base = dayInZone(now, zone);
      dates.set(zone, { base, last: when.value === 'all' ? null : addDays(base, Number(when.value) - 1) });
    }
    const { base, last } = dates.get(zone);
    const matchesDate = (region === 'imported' && when.value === 'all' || event.day >= base) && (!last || event.day <= last);
    const searchable = [event.title, event.venue, event.category, ...event.tags].join(' ').toLowerCase();
    return matchesDate && (!selectedCategory || selectedCategory === event.category) && terms.every(term => searchable.includes(term));
  }).sort(compare);
}

function updateCategories(events) {
  const selected = category.value;
  const unique = [...new Set(events.map(event => event.category))].sort();
  category.replaceChildren(new Option('All categories', ''), ...unique.map(value => new Option(human(value), value)));
  if (unique.includes(selected)) category.value = selected;
}

function render() {
  results.replaceChildren();
  get('paging').hidden = true;
  if (region === 'langley') {
    setStatus('Open a Langley venue calendar or import an .ics file to plan your visit.', false, link('Langley calendars ↓', '#calendars'));
    return;
  }
  const source = feeds.get(region);
  if (region !== 'imported' && !source?.data) {
    if (source?.error) setStatus('This city’s feed is unavailable right now. Try refreshing or open the city directory.', true, link(regions[region].name + ' on Has Things ↗', new URL(regions[region].url).origin));
    else setStatus('Opening the ' + regions[region].name + ' event feed…');
    return;
  }
  const list = region === 'imported' ? [...imports.values()] : source.data.events;
  updateCategories(list);
  const matches = filterEvents(list);
  const noun = matches.length === 1 ? ' event' : ' events';
  let note = matches.length ? matches.length + noun + ' match.' : 'No events match these filters.';
  if (source?.data && !list.length) note = 'The city feed currently lists no showtimes.';
  if (region === 'imported' && !list.length) note = 'No local events loaded. Open a calendar file below.';
  if (source?.loading) note += ' Refreshing…';
  if (source?.error) note += ' Refresh failed; showing the previous feed.';
  if (source?.data?.stamp) note += ' Feed generated ' + new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: regions[region].zone }).format(source.data.stamp) + ' local time.';
  if (source?.data?.windowDays) note += ' Source window: ' + source.data.windowDays + ' days.';
  if (source?.data?.truncated) note += ' The source capped this feed. Later events may be missing.';
  setStatus(note, Boolean(source?.error), source?.data ? link('Check the city directory ↗', new URL(regions[region].url).origin) : null);
  results.append(...matches.slice(0, pageLimit).map(eventCard));
  get('paging').hidden = pageLimit >= matches.length;
}

async function loadFeed(key, force = false) {
  if (!regions[key]?.url) return;
  const previous = feeds.get(key);
  if (previous?.loading || !force && previous?.data && Date.now() - previous.received < 180_000) return;
  const state = { data: previous?.data, loading: true, error: false };
  feeds.set(key, state);
  if (region === key) render();
  try {
    const response = await fetch(regions[key].url, {
      signal: AbortSignal.timeout(12000), referrerPolicy: 'no-referrer', credentials: 'omit',
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    state.data = normalizeFeed(await response.json(), key);
    state.received = Date.now();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    if (region === key) render();
  }
}

function switchRegion(key) {
  if (key !== 'imported' && !Object.hasOwn(regions, key)) return;
  region = key;
  query.value = '';
  category.value = '';
  when.value = key === 'imported' ? 'all' : '14';
  pageLimit = 25;
  cityPicker.value = key;
  const url = new URL(location.href);
  if (key === 'vancouver' || key === 'imported') url.searchParams.delete('city');
  else url.searchParams.set('city', key);
  if (url.href !== location.href) history.replaceState(null, '', url);
  const source = get('source-feed');
  source.href = regions[key]?.url || 'https://hasthings.com/';
  source.textContent = regions[key]?.url ? regions[key].name + ' listings feed' : 'Canadian city directory';
  refresh.hidden = !regions[key]?.url;
  get('view-heading').textContent = key === 'imported' ? 'My imported calendars' : regions[key].name + ' events';
  const supportFilters = key !== 'langley';
  for (const control of [query, when, category]) control.disabled = !supportFilters;
  render();
  loadFeed(key);
}

async function openCalendars(files) {
  const input = get('ical');
  const zone = get('zone').value;
  input.disabled = true;
  importStatus.textContent = 'Reading calendar files…';
  try {
    const { default: ICAL } = await import('./vendor/ical.mjs');
    const notes = [];
    let count = 0;
    let skipped = 0;
    let limited = false;
    for (const file of [...files].slice(0, 8)) {
      if (file.size > 2_000_000) {
        notes.push(file.name + ' exceeds 2 MB.');
        continue;
      }
      try {
        const data = importCalendar(await file.text(), ICAL, zone);
        if (imports.size + data.events.length > 5000) {
          notes.push('The tab holds up to 5,000 imported events. Clear imports or choose a smaller file.');
          break;
        }
        for (const event of data.events) {
          if (!imports.has(event.id)) count++;
          imports.set(event.id, event);
        }
        skipped += data.skipped;
        limited ||= data.limited;
      } catch (error) {
        notes.push(file.name + ': ' + error.message);
      }
    }
    if (files.length > 8) notes.push('Only the first eight files were read.');
    if (limited) notes.push('Some recurring series reached the expansion limit.');
    if (skipped) notes.push(skipped + ' invalid or unsupported entries skipped.');
    importStatus.textContent = [count + ' new events opened. Recurrences are shown up to 120 days ahead.', ...notes].join(' ');
    if (imports.size) switchRegion('imported');
  } catch {
    importStatus.textContent = 'The calendar parser did not load. Reload and try again.';
  } finally {
    input.disabled = false;
    input.value = '';
    get('clear-imports').disabled = !imports.size;
  }
}

function downloadPlans() {
  const url = URL.createObjectURL(new Blob([calendarFile([...plan.values()].sort(compare))], { type: 'text/calendar;charset=utf-8' }));
  const anchor = element('a');
  anchor.download = 'event-radar.ics';
  anchor.href = url;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

cityPicker.replaceChildren();
const zones = new Map();
for (const [province, cities] of Object.entries(provinces)) {
  const group = document.createElement('optgroup');
  group.label = province;
  for (const [key] of cities) {
    const city = regions[key];
    group.append(new Option(city.name + (city.url ? '' : ' · venue calendars'), key));
    if (!zones.has(city.zone)) zones.set(city.zone, city.zone.split('/')[1].replaceAll('_', ' '));
  }
  cityPicker.append(group);
}
cityPicker.append(new Option('My imported calendars', 'imported'));
get('zone').replaceChildren(...[...zones].sort((a, b) => a[1].localeCompare(b[1])).map(([id, label]) => new Option(label, id)));
get('zone').value = regions.vancouver.zone;
cityPicker.addEventListener('change', () => {
  const city = regions[cityPicker.value];
  if (city) get('zone').value = city.zone;
  switchRegion(cityPicker.value);
});
for (const control of [query, category, when]) control.addEventListener('input', () => { pageLimit = 25; render(); });
get('more').addEventListener('click', () => {
  const previous = pageLimit;
  pageLimit += 25;
  render();
  results.children[previous]?.querySelector('button')?.focus();
});
refresh.addEventListener('click', () => loadFeed(region, true));
get('download').addEventListener('click', downloadPlans);
get('ical').addEventListener('change', event => openCalendars(event.target.files));
get('clear-imports').addEventListener('click', () => {
  for (const id of imports.keys()) plan.delete(id);
  imports.clear();
  get('clear-imports').disabled = true;
  importStatus.textContent = 'Local calendar files cleared.';
  renderPlan();
  render();
});
const initial = new URLSearchParams(location.search).get('city');
const initialCity = Object.hasOwn(regions, initial) ? initial : 'vancouver';
get('zone').value = regions[initialCity].zone;
switchRegion(initialCity);
