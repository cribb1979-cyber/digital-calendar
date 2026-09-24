import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEventText } from './parser.js';

// Thursday 24 September 2026, 10:00
const NOW = new Date(2026, 8, 24, 10, 0);
const parse = (text) => parseEventText(text, NOW);

test('relative day and explicit 24h time', () => {
  const r = parse('Tandläkare imorgon klockan 15');
  assert.equal(r.title, 'Tandläkare');
  assert.equal(r.date, '2026-09-25');
  assert.equal(r.time, '15:00');
  assert.equal(r.ambiguousTimes, null);
  assert.deepEqual(r.missing, []);
});

test('ambiguous hour asks for clarification and suggests afternoon', () => {
  const r = parse('möte med Anna på fredag klockan 3');
  assert.equal(r.title, 'Möte med Anna');
  assert.equal(r.date, '2026-09-25');
  assert.equal(r.time, '15:00');
  assert.deepEqual(r.ambiguousTimes, ['03:00', '15:00']);
});

test('daypart resolves ambiguity', () => {
  assert.equal(parse('middag klockan 7 på kvällen').time, '19:00');
  assert.equal(parse('gym klockan 7 på morgonen').time, '07:00');
  assert.equal(parse('bio ikväll kl 8').time, '20:00');
  assert.equal(parse('bio ikväll kl 8').date, '2026-09-24');
});

test('morning hours 8-12 are not ambiguous', () => {
  const r = parse('standup kl 9');
  assert.equal(r.time, '09:00');
  assert.equal(r.ambiguousTimes, null);
});

test('minutes and zero-padded times', () => {
  assert.equal(parse('lunch idag 12:30').time, '12:30');
  const r = parse('tåg idag 07.45');
  assert.equal(r.time, '07:45');
  assert.equal(r.ambiguousTimes, null);
});

test('spoken Swedish clock expressions', () => {
  assert.equal(parse('fika halv tre idag').time, '14:30');
  assert.equal(parse('fika kvart över tio idag').time, '10:15');
  assert.equal(parse('fika kvart i elva idag').time, '10:45');
  assert.equal(parse('samtal klockan fjorton idag').time, '14:00');
});

test('weekday resolution', () => {
  assert.equal(parse('frisör på måndag kl 10').date, '2026-09-28');
  // Today is Thursday: "torsdag" means next week's Thursday
  assert.equal(parse('frisör torsdag kl 10').date, '2026-10-01');
  assert.equal(parse('frisör nästa fredag kl 10').date, '2026-10-02');
});

test('absolute dates', () => {
  assert.equal(parse('födelsedag den 5 oktober').date, '2026-10-05');
  assert.equal(parse('födelsedag 3:e mars').date, '2027-03-03');
  assert.equal(parse('resa 12/11').date, '2026-11-12');
  assert.equal(parse('resa 2026-12-24').date, '2026-12-24');
  assert.equal(parse('resa den 30:e').date, '2026-09-30');
  assert.equal(parse('resa om 3 dagar').date, '2026-09-27');
  assert.equal(parse('resa om en vecka').date, '2026-10-01');
});

test('time ranges and durations', () => {
  const r = parse('workshop imorgon mellan 13 och 15');
  assert.equal(r.title, 'Workshop');
  assert.equal(r.time, '13:00');
  assert.equal(r.endTime, '15:00');

  const r2 = parse('workshop imorgon kl 9-11:30');
  assert.equal(r2.time, '09:00');
  assert.equal(r2.endTime, '11:30');

  const r3 = parse('möte imorgon kl 14 i en och en halv timme');
  assert.equal(r3.title, 'Möte');
  assert.equal(r3.durationMinutes, 90);
});

test('reminders', () => {
  const r = parse('Ring mamma imorgon kl 18 påminn mig 30 minuter innan');
  assert.equal(r.title, 'Ring mamma');
  assert.equal(r.reminderMinutes, 30);
  assert.equal(parse('flyg på lördag kl 6 med påminnelse 1 dag innan').reminderMinutes, 1440);
  assert.equal(parse('flyg kl 14').reminderMinutes, undefined);
});

test('filler words are stripped from the title', () => {
  assert.equal(parse('Lägg till ett möte med chefen imorgon kl 10').title, 'Möte med chefen');
  assert.equal(parse('påminn mig om att köpa mjölk idag kl 17').title, 'Köpa mjölk');
});

test('all-day events and missing fields', () => {
  const r = parse('semester den 5 oktober hela dagen');
  assert.equal(r.allDay, true);
  assert.equal(r.time, null);
  assert.deepEqual(r.missing, []);

  assert.deepEqual(parse('tandläkare').missing, ['date', 'time']);
  assert.deepEqual(parse('imorgon kl 15').missing, ['title']);
});
