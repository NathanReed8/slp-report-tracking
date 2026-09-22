const test = require('node:test');
const assert = require('node:assert/strict');
const { addDuration, daysRemaining, statusForDays } = require('./date-utils');

test('adds days and weeks using calendar days', () => {
  assert.equal(addDuration('2026-01-30', 3, 'days'), '2026-02-02');
  assert.equal(addDuration('2026-01-30', 2, 'weeks'), '2026-02-13');
});

test('adds calendar months and clamps end-of-month dates', () => {
  assert.equal(addDuration('2026-01-31', 1, 'months'), '2026-02-28');
  assert.equal(addDuration('2028-01-31', 1, 'months'), '2028-02-29');
  assert.equal(addDuration('2026-11-30', 3, 'months'), '2027-02-28');
});

test('calculates signed day differences without timezone drift', () => {
  assert.equal(daysRemaining('2026-08-19', '2026-08-19'), 0);
  assert.equal(daysRemaining('2026-08-18', '2026-08-19'), -1);
  assert.equal(daysRemaining('2026-08-26', '2026-08-19'), 7);
});

test('classifies every urgency threshold', () => {
  assert.equal(statusForDays(-1).className, 'status-overdue');
  assert.equal(statusForDays(0).className, 'status-overdue');
  assert.equal(statusForDays(1).className, 'status-warning');
  assert.equal(statusForDays(7).className, 'status-warning');
  assert.equal(statusForDays(8).className, 'status-soon');
  assert.equal(statusForDays(30).className, 'status-soon');
  assert.equal(statusForDays(31).className, 'status-safe');
});
