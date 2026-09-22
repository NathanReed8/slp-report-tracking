const test = require('node:test');
const assert = require('node:assert/strict');
const { addDuration, defaultDueDates, createClientSchedule, establishedIntakeOptions, createEstablishedClientSchedule, projectedSchedule, setScheduleOverride, advanceSubmission, reanchorSchedule } = require('./date-utils');
const { defaultSettings, isSettings } = require('./settings-utils');

test('adds calendar durations without timezone drift', () => {
  assert.equal(addDuration('2026-01-30', 2, 'weeks'), '2026-02-13');
  assert.equal(addDuration('2026-01-31', 1, 'months'), '2026-02-28');
  assert.equal(addDuration('2028-01-31', 1, 'months'), '2028-02-29');
});
test('uses the simplified default cycles from the initial evaluation', () => {
  const settings = defaultSettings();
  assert.deepEqual(settings.schedules.medicaid.cycle, ['progress', 'eval']);
  assert.deepEqual(settings.schedules.nonMedicaid.cycle, ['progress', 'progress', 'progress', 'eval']);
  assert.deepEqual(defaultDueDates('2026-01-31', 'yes', settings), { nextProgressDue: '2026-05-01', nextEvalDue: '2026-07-30' });
  assert.deepEqual(defaultDueDates('2026-01-31', 'no', settings), { nextProgressDue: '2026-05-01', nextEvalDue: '2027-01-26' });
});
test('requires a positive interval and both task types in every cycle', () => {
  const settings = defaultSettings();
  assert.equal(isSettings(settings), true);
  settings.schedules.medicaid.cycle = ['progress'];
  assert.equal(isSettings(settings), false);
  settings.schedules.medicaid.cycle = ['progress', 'eval'];
  settings.schedules.nonMedicaid.interval.value = 0;
  assert.equal(isSettings(settings), false);
});
test('projects one chronological cycle while retaining the next date for each task type', () => {
  const client = createClientSchedule('2026-01-01', defaultSettings().schedules.nonMedicaid);
  const schedule = projectedSchedule(client);
  assert.equal(schedule.current.type, 'progress');
  assert.equal(schedule.progress.dueDate, '2026-04-01');
  assert.equal(schedule.eval.dueDate, '2026-12-27');
  assert.deepEqual(schedule.tasks.map((task) => task.type), ['progress', 'progress', 'progress', 'eval']);
});
test('submissions advance only the current task and retain the fixed interval', () => {
  let client = createClientSchedule('2026-01-01', defaultSettings().schedules.medicaid);
  assert.throws(() => advanceSubmission(client, 'eval', '2026-04-01'), /Only the next/);
  client = advanceSubmission(client, 'progress', '2026-03-30');
  assert.equal(client.nextEvalDue, '2026-06-30');
  assert.equal(client.nextProgressDue, '2026-09-28');
  assert.deepEqual(client.submissionHistory[0], { type: 'progress', dueDate: '2026-04-01', submittedDate: '2026-03-30' });
});
test('a one-off override does not shift later tasks and cannot reorder the cycle', () => {
  let client = createClientSchedule('2026-01-01', defaultSettings().schedules.medicaid);
  client = setScheduleOverride(client, 'progress', '2026-04-15');
  assert.equal(client.nextProgressDue, '2026-04-15');
  assert.equal(client.nextEvalDue, '2026-06-30');
  client = advanceSubmission(client, 'progress', '2026-04-15');
  assert.equal(client.nextEvalDue, '2026-06-30');
  assert.throws(() => setScheduleOverride(client, 'eval', '2026-12-01'), /cannot change/);
});
test('settings re-anchor active clients at their pending type and clear overrides', () => {
  let client = createClientSchedule('2026-01-01', defaultSettings().schedules.nonMedicaid);
  client = setScheduleOverride(client, 'progress', '2026-04-10');
  const newProfile = { interval: { value: 2, unit: 'months' }, cycle: ['eval', 'progress', 'progress'] };
  client = reanchorSchedule(client, newProfile);
  assert.equal(client.cyclePosition, 1);
  assert.equal(client.nextProgressDue, '2026-04-01');
  assert.equal(client.nextEvalDue, '2026-08-01');
  assert.deepEqual(client.dueOverrides, {});
});

test('adds an established Medicaid client from the last evaluation anchor', () => {
  const client = createEstablishedClientSchedule('2026-01-01', '', defaultSettings().schedules.medicaid);
  assert.equal(client.nextProgressDue, '2026-04-01');
  assert.equal(client.nextEvalDue, '2026-06-30');
  assert.equal(projectedSchedule(client).current.type, 'progress');
  assert.deepEqual(client.submissionHistory, []);
});

test('uses a bounded progress count without using historical date spacing', () => {
  const profile = defaultSettings().schedules.nonMedicaid;
  const options = establishedIntakeOptions('2026-01-01', '2026-11-20', profile);
  assert.equal(options.latestType, 'progress');
  assert.equal(options.requiresChoice, true);
  assert.deepEqual(options.choices.map((choice) => choice.count), [1, 2, 3]);
  const client = createEstablishedClientSchedule('2026-01-01', '2026-11-20', profile, options.choices[1].value);
  assert.equal(projectedSchedule(client).current.type, 'progress');
  assert.equal(client.nextProgressDue, '2026-09-28');
  assert.equal(client.nextEvalDue, '2026-12-27');
  assert.deepEqual(client.submissionHistory, [
    { type: 'progress', dueDate: '2026-04-01', submittedDate: '2026-04-01', estimated: true },
    { type: 'progress', dueDate: '2026-06-30', submittedDate: '2026-11-20' }
  ]);
});

test('estimates repeated evaluations and preserves the real preceding progress report', () => {
  const profile = { interval: { value: 1, unit: 'months' }, cycle: ['progress', 'eval', 'eval'] };
  const options = establishedIntakeOptions('2026-06-15', '2026-02-20', profile);
  assert.equal(options.latestType, 'eval');
  assert.equal(options.requiresChoice, true);
  const client = createEstablishedClientSchedule('2026-06-15', '2026-02-20', profile, options.choices[1].value);
  assert.equal(projectedSchedule(client).current.type, 'progress');
  assert.equal(client.nextProgressDue, '2026-07-15');
  assert.deepEqual(client.submissionHistory, [
    { type: 'eval', dueDate: '2026-05-15', submittedDate: '2026-05-15', estimated: true },
    { type: 'progress', dueDate: '2026-04-15', submittedDate: '2026-02-20' }
  ]);
});

test('rejects established-client dates that do not establish an order', () => {
  assert.throws(() => establishedIntakeOptions('2026-01-01', '2026-01-01', defaultSettings().schedules.medicaid), /must be different/);
});
