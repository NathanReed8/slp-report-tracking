function parseDateParts(value) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function toUtcDayNumber(value) {
  const { year, month, day } = parseDateParts(value);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDuration(dateValue, duration, unit) {
  const { year, month, day } = parseDateParts(dateValue);
  if (unit === 'days' || unit === 'weeks') {
    const offset = unit === 'weeks' ? duration * 7 : duration;
    return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
  }
  const targetMonthIndex = month - 1 + duration;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function daysRemaining(expiryDate, today = formatLocalDate()) {
  return toUtcDayNumber(expiryDate) - toUtcDayNumber(today);
}

function statusForDays(days) {
  if (days <= 0) return { className: 'status-overdue', label: days < 0 ? 'Overdue' : 'Due today' };
  if (days <= 7) return { className: 'status-warning', label: 'Due within 7 days' };
  if (days <= 30) return { className: 'status-soon', label: 'Due within 30 days' };
  return { className: 'status-safe', label: 'More than 30 days until due' };
}

function addInterval(dateValue, interval) { return addDuration(dateValue, interval.value, interval.unit); }
function isScheduleInterval(value) { return Boolean(value) && Number.isInteger(value.value) && value.value > 0 && ['days', 'weeks', 'months'].includes(value.unit); }
function scheduleProfileIsValid(profile) {
  return Boolean(profile) && isScheduleInterval(profile.interval) && Array.isArray(profile.cycle) && profile.cycle.length > 0
    && profile.cycle.every((type) => ['progress', 'eval'].includes(type))
    && profile.cycle.includes('progress') && profile.cycle.includes('eval');
}
function scheduleSnapshot(profile) { return { interval: { ...profile.interval }, cycle: [...profile.cycle] }; }
function hasScheduleSnapshot(client) {
  return Boolean(client && scheduleProfileIsValid(client.schedule) && /^\d{4}-\d{2}-\d{2}$/.test(client.nextCycleDue || '')
    && Number.isInteger(client.cyclePosition) && client.cyclePosition >= 0 && Number.isInteger(client.cycleStep) && client.cycleStep >= 0);
}

function baseScheduleClient(creationDate, profile) {
  return { schedule: scheduleSnapshot(profile), nextCycleDue: addInterval(creationDate, profile.interval), cyclePosition: 0, cycleStep: 0, dueOverrides: {} };
}

function projectedSchedule(client) {
  if (!hasScheduleSnapshot(client)) {
    const tasks = [
      client.nextProgressDue && { type: 'progress', dueDate: client.nextProgressDue, baseDueDate: client.nextProgressDue, step: 0 },
      client.nextEvalDue && { type: 'eval', dueDate: client.nextEvalDue, baseDueDate: client.nextEvalDue, step: 1 }
    ].filter(Boolean).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    tasks.forEach((task, index) => { task.isCurrent = index === 0; });
    return { tasks, current: tasks[0] || null, progress: tasks.find((task) => task.type === 'progress') || null, eval: tasks.find((task) => task.type === 'eval') || null, legacy: true };
  }
  const tasks = [];
  const profile = client.schedule;
  const overrides = client.dueOverrides && typeof client.dueOverrides === 'object' ? client.dueOverrides : {};
  let baseDueDate = client.nextCycleDue;
  let position = client.cyclePosition % profile.cycle.length;
  let step = client.cycleStep;
  while (!tasks.some((task) => task.type === 'progress') || !tasks.some((task) => task.type === 'eval')) {
    const type = profile.cycle[position];
    tasks.push({ type, step, baseDueDate, dueDate: overrides[step] || baseDueDate, isCurrent: tasks.length === 0 });
    baseDueDate = addInterval(baseDueDate, profile.interval);
    position = (position + 1) % profile.cycle.length;
    step += 1;
  }
  return { tasks, current: tasks[0], progress: tasks.find((task) => task.type === 'progress'), eval: tasks.find((task) => task.type === 'eval'), legacy: false };
}

function applyProjectedDates(client) {
  const projected = projectedSchedule(client);
  return { ...client, nextProgressDue: projected.progress ? projected.progress.dueDate : '', nextEvalDue: projected.eval ? projected.eval.dueDate : '' };
}

function defaultDueDates(creationDate, medicaidClient, settings) {
  const profile = settings && settings.schedules ? settings.schedules[medicaidClient === 'yes' ? 'medicaid' : 'nonMedicaid'] : null;
  if (!scheduleProfileIsValid(profile)) return { nextProgressDue: '', nextEvalDue: '' };
  const schedule = applyProjectedDates(baseScheduleClient(creationDate, profile));
  return { nextProgressDue: schedule.nextProgressDue, nextEvalDue: schedule.nextEvalDue };
}

function createClientSchedule(creationDate, profile) {
  if (!scheduleProfileIsValid(profile)) throw new TypeError('A valid schedule profile is required');
  return applyProjectedDates(baseScheduleClient(creationDate, profile));
}

function intervalSteps(dateValue, steps, interval) {
  return addDuration(dateValue, steps * interval.value, interval.unit);
}

function runsForType(profile, type) {
  const cycle = profile.cycle;
  const runs = [];
  cycle.forEach((item, index) => {
    const previousIndex = (index - 1 + cycle.length) % cycle.length;
    if (item !== type || cycle[previousIndex] === type) return;
    const positions = [];
    let position = index;
    while (cycle[position] === type) {
      positions.push(position);
      position = (position + 1) % cycle.length;
    }
    runs.push(positions);
  });
  return runs;
}

function establishedIntakeOptions(lastEvaluationDate, lastProgressReportDate, profile) {
  if (!scheduleProfileIsValid(profile)) throw new TypeError('A valid schedule profile is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastEvaluationDate || '')) throw new TypeError('Enter a valid last evaluation date');
  if (lastProgressReportDate && !/^\d{4}-\d{2}-\d{2}$/.test(lastProgressReportDate)) throw new TypeError('Enter a valid last progress report date');
  if (lastProgressReportDate === lastEvaluationDate) throw new RangeError('Last evaluation and progress report dates must be different');

  const latestType = lastProgressReportDate && lastProgressReportDate > lastEvaluationDate ? 'progress' : 'eval';
  const previousType = latestType === 'progress' ? 'eval' : 'progress';
  const runs = runsForType(profile, latestType);
  const choices = runs.flatMap((positions, runIndex) => positions.map((position, index) => ({
    value: `${runIndex}:${index + 1}`,
    count: index + 1,
    position,
    runIndex,
    label: runs.length === 1 ? String(index + 1) : `${index + 1} (sequence ${runIndex + 1})`
  })));
  return {
    latestType,
    previousType,
    choices,
    requiresChoice: choices.length > 1
  };
}

function estimatedHistoryEntry(type, dueDate) {
  return { type, dueDate, submittedDate: dueDate, estimated: true };
}

function createEstablishedClientSchedule(lastEvaluationDate, lastProgressReportDate, profile, occurrenceValue) {
  const intake = establishedIntakeOptions(lastEvaluationDate, lastProgressReportDate, profile);
  const selected = intake.choices.find((choice) => choice.value === occurrenceValue) || (!intake.requiresChoice ? intake.choices[0] : null);
  if (!selected) throw new TypeError('Choose how many submissions have been made in this part of the cycle');

  const schedule = scheduleSnapshot(profile);
  const nextCycleDue = intervalSteps(lastEvaluationDate, intake.latestType === 'progress' ? selected.count + 1 : 1, schedule.interval);
  const client = {
    schedule,
    nextCycleDue,
    cyclePosition: (selected.position + 1) % schedule.cycle.length,
    cycleStep: 0,
    dueOverrides: {},
    submissionHistory: []
  };

  if (intake.latestType === 'progress') {
    for (let index = 1; index <= selected.count; index += 1) {
      const dueDate = intervalSteps(lastEvaluationDate, index, schedule.interval);
      client.submissionHistory.push(index === selected.count
        ? { type: 'progress', dueDate, submittedDate: lastProgressReportDate }
        : estimatedHistoryEntry('progress', dueDate));
    }
  } else {
    for (let index = 1; index < selected.count; index += 1) {
      const dueDate = intervalSteps(lastEvaluationDate, index - selected.count, schedule.interval);
      client.submissionHistory.push(estimatedHistoryEntry('eval', dueDate));
    }
    if (lastProgressReportDate) {
      const dueDate = intervalSteps(lastEvaluationDate, -selected.count, schedule.interval);
      client.submissionHistory.push({ type: 'progress', dueDate, submittedDate: lastProgressReportDate });
    }
  }
  return applyProjectedDates(client);
}

function setScheduleOverride(client, type, dueDate) {
  if (!hasScheduleSnapshot(client)) throw new TypeError('This client does not use a cycle schedule');
  const projected = projectedSchedule(client);
  const taskIndex = projected.tasks.findIndex((task) => task.type === type);
  if (taskIndex < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || '')) throw new TypeError('Choose a valid scheduled task and due date');
  const task = projected.tasks[taskIndex];
  const previous = projected.tasks[taskIndex - 1];
  const following = projected.tasks[taskIndex + 1] || { dueDate: addInterval(task.baseDueDate, client.schedule.interval) };
  if ((previous && dueDate < previous.dueDate) || (following && dueDate > following.dueDate)) throw new RangeError('A one-off due date cannot change the task cycle order');
  const overrides = { ...(client.dueOverrides || {}) };
  if (dueDate === task.baseDueDate) delete overrides[task.step];
  else overrides[task.step] = dueDate;
  return applyProjectedDates({ ...client, dueOverrides: overrides });
}

function advanceSubmission(client, type, submittedDate) {
  const projected = projectedSchedule(client);
  const current = projected.current;
  if (!current || current.type !== type) throw new RangeError('Only the next scheduled task can be submitted');
  const historyEntry = { type, dueDate: current.dueDate, submittedDate };
  if (projected.legacy) return { ...client, submissionHistory: [...(Array.isArray(client.submissionHistory) ? client.submissionHistory : []), historyEntry] };
  const overrides = { ...(client.dueOverrides || {}) };
  delete overrides[current.step];
  return applyProjectedDates({
    ...client,
    nextCycleDue: addInterval(client.nextCycleDue, client.schedule.interval),
    cyclePosition: (client.cyclePosition + 1) % client.schedule.cycle.length,
    cycleStep: client.cycleStep + 1,
    dueOverrides: overrides,
    submissionHistory: [...(Array.isArray(client.submissionHistory) ? client.submissionHistory : []), historyEntry]
  });
}

function reanchorSchedule(client, profile) {
  if (!scheduleProfileIsValid(profile)) throw new TypeError('A valid schedule profile is required');
  const current = projectedSchedule(client).current;
  const position = current ? profile.cycle.indexOf(current.type) : 0;
  const nextCycleDue = hasScheduleSnapshot(client) ? client.nextCycleDue : (current ? current.baseDueDate : addInterval(client.creationDate, profile.interval));
  return applyProjectedDates({ ...client, schedule: scheduleSnapshot(profile), nextCycleDue, cyclePosition: position < 0 ? 0 : position, cycleStep: 0, dueOverrides: {} });
}

if (typeof module !== 'undefined') module.exports = { addDuration, addInterval, daysRemaining, formatLocalDate, statusForDays, scheduleProfileIsValid, scheduleSnapshot, hasScheduleSnapshot, projectedSchedule, applyProjectedDates, defaultDueDates, createClientSchedule, establishedIntakeOptions, createEstablishedClientSchedule, setScheduleOverride, advanceSubmission, reanchorSchedule };
