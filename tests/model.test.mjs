import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFeed, calendarFile, dayInZone, addDays} from '../web/model.mjs';
const raw={city:{slug:'vancouver',countryCode:'CA'},items:[{id:'one',title:'Test event',startsAt:'2026-01-02T03:00:00Z',startTimeKnown:false,url:'javascript:alert(1)'}]};
test('unknown showtimes stay unknown and links are restricted',()=>{const e=normalizeFeed(raw,'vancouver').events[0];assert.equal(e.day,'2026-01-01');assert.equal(e.start,null);assert.equal(e.url,'');});
test('wrong city or country is rejected instead of showing misleading listings',()=>{assert.throws(()=>normalizeFeed(raw,'halifax'));assert.throws(()=>normalizeFeed({...raw,city:{slug:'vancouver',countryCode:'US'}},'vancouver'));});
test('calendar export escapes content, retains attribution and marks unknown times',()=>{const e=normalizeFeed(raw,'vancouver').events[0];e.title='One, two; three\nFour';const text=calendarFile([e],Date.parse('2026-01-01T00:00:00Z'));assert.ok(text.includes('SUMMARY:One\\, two\\; three\\nFour'));assert.ok(text.includes('DTSTART;VALUE=DATE:20260101'));assert.ok(text.includes('Time unlisted'));assert.ok(text.includes('ODbL'));});
test('local dates respect half-hour zones and leap-day arithmetic',()=>{assert.equal(dayInZone(Date.parse('2026-01-01T03:15:00Z'),'America/St_Johns'),'2025-12-31');assert.equal(addDays('2024-02-28',1),'2024-02-29');});
