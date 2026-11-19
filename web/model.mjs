import { regions } from './regions.mjs';
export { regions };

const DAY_MS = 86_400_000;
const catalogueLicence = 'Data: Has Things (hasthings.com) · ODbL 1.0 https://opendatacommons.org/licenses/odbl/1-0/';

const dateFormatters = new Map();
const clockFormatters = new Map();
function dateFormatter(zone) {
  if (!dateFormatters.has(zone)) dateFormatters.set(zone, new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }));
  return dateFormatters.get(zone);
}

export function dayInZone(time, zone) {
  const fields = Object.fromEntries(dateFormatter(zone).formatToParts(time).map(x => [x.type, x.value]));
  return fields.year + '-' + fields.month + '-' + fields.day;
}

export function addDays(isoDay, days) {
  return new Date(Date.parse(isoDay + 'T00:00:00Z') + days * DAY_MS).toISOString().slice(0, 10);
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeFeed(raw, key) {
  if (raw?.city?.slug !== key || raw.city.countryCode !== 'CA' || !Array.isArray(raw.items) || !regions[key]?.url) throw new Error('Unexpected source response');
  const { zone, name } = regions[key];
  const events = new Map();
  for (const row of raw.items.slice(0, 5000)) {
    const start = Date.parse(row?.startsAt);
    if (typeof row?.id !== 'string' || typeof row.title !== 'string' || !row.title.trim() || !Number.isFinite(start)) continue;
    const id = key + ':' + row.id;
    const end = Date.parse(row.endsAt);
    const known = row.startTimeKnown === true;
    events.set(id, {
      id, day: dayInZone(start, zone), start: known ? start : null,
      end: known && Number.isFinite(end) && end > start ? end : null, allDay: false,
      title: row.title.slice(0, 260), venue: String(row.venue?.name || '').slice(0, 180),
      category: String(row.category || 'other').slice(0, 80), place: name, zone,
      status: String(row.status || 'scheduled').toLowerCase(), source: 'Has Things',
      confidence: typeof row.confidence === 'string' ? row.confidence : '',
      url: safeLink(row.url), tickets: safeLink(row.ticketUrl),
      tags: Array.isArray(row.tags) ? row.tags.map(tag => tag?.label).filter(label => typeof label === 'string').slice(0, 20) : [],
    });
  }
  return {
    events: [...events.values()],
    stamp: Number.isFinite(Date.parse(raw.generatedAt)) ? Date.parse(raw.generatedAt) : null,
    truncated: raw.truncated === true,
    windowDays: Number.isInteger(raw.windowDays) && raw.windowDays > 0 ? raw.windowDays : null,
  };
}

const num = value => String(value).padStart(2, '0');
function civil(time) {
  return time.year + '-' + num(time.month) + '-' + num(time.day);
}

function wallTimestamp(time, zone) {
  // A floating time is a wall clock reading in the selected region. Convert it
  // using the browser's timezone database, including half-hour offsets and DST.
  let actual = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
  const wall = actual;
  if (!clockFormatters.has(zone)) clockFormatters.set(zone, new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }));
  const fmt = clockFormatters.get(zone);
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(actual).map(x => [x.type, Number(x.value)]));
    const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = wall - shown;
    if (!adjustment) return actual;
    actual += adjustment;
  }
  // Some wall times do not exist at a DST transition.
  return NaN;
}

function clock(time, zone) {
  if (!time || time.year < 1900 || time.year > 2200 || time.isDate) return NaN;
  if (time.zone?.tzid && time.zone.tzid !== 'floating') return time.toUnixTime() * 1000;
  return wallTimestamp(time, zone);
}

function validZone(value, fallback) {
  if (!value) return fallback;
  try {
    dateFormatter(value);
    return value;
  } catch {
    return fallback;
  }
}

function eventRow(item, startTime, endTime, fallback, seriesId) {
  if (!startTime || startTime.year < 1900 || startTime.year > 2200) return null;
  const declared = item.component.getFirstProperty('dtstart')?.getParameter('tzid');
  const zone = validZone(declared, fallback);
  const start = clock(startTime, zone);
  const end = clock(endTime, zone);
  if (!startTime.isDate && !Number.isFinite(start)) return null;
  const day = startTime.isDate ? civil(startTime) : dayInZone(start, zone);
  const endDay = startTime.isDate && endTime?.isDate && civil(endTime) > day ? civil(endTime) : null;
  const url = safeLink(item.component.getFirstPropertyValue('url'));
  return {
    id: 'import:' + seriesId + ':' + (Number.isFinite(start) ? start : day),
    day, start: Number.isFinite(start) ? start : null, end: Number.isFinite(end) && end > start ? end : null,
    endDay, allDay: startTime.isDate, title: String(item.summary || 'Untitled event').slice(0, 260),
    venue: String(item.location || '').slice(0, 180), category: 'imported', place: '', zone,
    status: String(item.component.getFirstPropertyValue('status') || 'scheduled').toLowerCase(),
    source: 'Local calendar', url, tickets: '', tags: [],
  };
}

export function importCalendar(text, ICAL, zone, now = Date.now()) {
  const calendar = new ICAL.Component(ICAL.parse(text));
  if (calendar.name !== 'vcalendar') throw new Error('That file does not contain an iCalendar calendar.');
  ICAL.TimezoneService.reset();
  for (const tz of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);
  const events = calendar.getAllSubcomponents('vevent');
  if (!events.length) throw new Error('That calendar contains no VEVENT entries.');
  if (events.length > 5000) throw new Error('That calendar has too many events. Export a smaller calendar and try again.');

  const lower = dayInZone(now, zone);
  const upper = addDays(lower, 120);
  const found = new Map();
  const exceptions = new Map();
  const masters = new Set();
  for (const component of events) {
    const uid = component.getFirstPropertyValue('uid');
    if (!uid) continue;
    if (!component.hasProperty('recurrence-id')) {
      masters.add(uid);
      continue;
    }
    if (!exceptions.has(uid)) exceptions.set(uid, []);
    exceptions.get(uid).push(component);
  }
  const firstIterationDay = addDays(lower, -1);
  const lastIterationDay = addDays(upper, 1);
  let skipped = 0;
  let limited = false;
  let iterations = 0;
  for (const [index, component] of events.entries()) {
    const uid = component.getFirstPropertyValue('uid') || 'row-' + index;
    if (component.hasProperty('recurrence-id') && masters.has(uid)) continue;
    try {
      const item = new ICAL.Event(component, { exceptions: component.hasProperty('recurrence-id') ? [] : exceptions.get(uid) || [], strictExceptions: true });
      if (!item.startDate) {
        skipped++;
        continue;
      }
      if (!item.isRecurring()) {
        const row = eventRow(item, item.startDate, item.endDate, zone, uid);
        if (row) found.set(row.id, row);
        else skipped++;
        continue;
      }
      const iterator = item.iterator();
      let occurrence;
      let count = 0;
      while (count < 12000 && iterations < 24000 && (occurrence = iterator.next())) {
        count++;
        iterations++;
        const roughDay = civil(occurrence);
        if (roughDay > lastIterationDay) break;
        if (roughDay < firstIterationDay) continue;
        const resolved = item.getOccurrenceDetails(occurrence);
        const row = eventRow(resolved.item, resolved.startDate, resolved.endDate, zone, uid);
        if (row && row.day >= lower && row.day <= upper) found.set(row.id, row);
      }
      if (count === 12000 || iterations === 24000) limited = true;
      if (found.size > 2500) throw new RangeError();
    } catch (e) {
      if (e instanceof RangeError && found.size > 2500) throw new Error('This calendar expands to too many events. Export a smaller date range.');
      skipped++;
    }
  }
  return { events: [...found.values()], skipped, limited };
}

function escapeICSText(text) {
  return String(text).replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function compactUTC(epoch) {
  return new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const encoder = new TextEncoder();
function fold(line) {
  let result = '';
  let used = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (used + bytes > 75) {
      result += '\r\n ';
      used = 1;
    }
    result += character;
    used += bytes;
  }
  return result;
}

export function calendarFile(events, now = Date.now()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CoolCode//Event Radar//EN', 'CALSCALE:GREGORIAN'];
  if (events.some(event => event.source === 'Has Things')) lines.push('X-WR-CALDESC:' + escapeICSText(catalogueLicence));
  for (const event of events) {
    lines.push('BEGIN:VEVENT', 'UID:' + encodeURIComponent(event.id) + '@eventradar.coolcode.ca', 'DTSTAMP:' + compactUTC(now));
    if (event.start === null) {
      lines.push('DTSTART;VALUE=DATE:' + event.day.replaceAll('-', ''));
      if (event.endDay) lines.push('DTEND;VALUE=DATE:' + event.endDay.replaceAll('-', ''));
    } else {
      lines.push('DTSTART:' + compactUTC(event.start));
      if (event.end !== null) lines.push('DTEND:' + compactUTC(event.end));
    }
    lines.push('SUMMARY:' + escapeICSText(event.title));
    if (event.venue) lines.push('LOCATION:' + escapeICSText(event.venue));
    if (event.url) lines.push('URL:' + event.url);
    const notes = [];
    if (event.source === 'Has Things') notes.push(catalogueLicence);
    if (event.start === null && !event.allDay) notes.push('Time unlisted. Check the organizer.');
    if (event.status !== 'scheduled' && event.status !== 'confirmed') notes.push('Source status: ' + event.status + '.');
    if (notes.length) lines.push('DESCRIPTION:' + escapeICSText(notes.join('\n')));
    if (event.status === 'cancelled') lines.push('STATUS:CANCELLED');
    lines.push('END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR', ''].map(fold).join('\r\n');
}
