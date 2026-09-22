let clients = [];
const defaultSort = { key: 'soonestDue', direction: 'ascending' };
let sort = { ...defaultSort };
let editingClientId = null;
let submissionClientId = null;
let submissionType = null;
let appSettings = defaultSettings();
let activeIntakeTab = 'new';
let establishedOptions = null;
const $ = (id) => document.getElementById(id);
const dialog = $('token-dialog');
const deleteDialog = $('delete-dialog');
const submissionDialog = $('submission-dialog');
const historyDialog = $('history-dialog');
let deleteDecision = null;

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function readableDate(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function projection(client) { return projectedSchedule(client); }
function currentTask(client) { return projection(client).current; }
function soonestDueDate(client) { return currentTask(client)?.dueDate || '9999-12-31'; }
function sortedClients() {
  const filter = $('medicaid-filter').value;
  return clients.filter((client) => filter === 'all' || client.medicaidClient === filter).sort((a, b) => {
    const result = sort.key === 'name' ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : sort.key === 'soonestDue' ? soonestDueDate(a).localeCompare(soonestDueDate(b)) : (a[sort.key] || '').localeCompare(b[sort.key] || '');
    return result === 0 ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : (sort.direction === 'ascending' ? result : -result);
  });
}
function dueCell(dueDate) {
  if (!dueDate) return '<td><span class="due-days">Not scheduled</span></td>';
  const remaining = daysRemaining(dueDate); const status = statusForDays(remaining);
  const icon = remaining <= 0 ? '<svg class="status-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.1v4.2M8 10.9v.2" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>' : '';
  return `<td><div class="report-cell"><span class="report-date">${readableDate(dueDate)}</span><span class="status-pill ${status.className}" aria-label="${status.label}: ${remaining} days until due">${icon}${remaining} days</span></div></td>`;
}
function render() {
  const visibleClients = sortedClients();
  $('token-rows').innerHTML = visibleClients.map((client) => `<tr><td>${escapeHtml(client.name)}</td><td>${client.medicaidClient === 'yes' ? 'Yes' : 'No'}</td>${dueCell(client.nextProgressDue)}${dueCell(client.nextEvalDue)}</tr>`).join('');
  $('left-actions').innerHTML = visibleClients.length ? `<div class="floating-action-spacer" aria-hidden="true"></div>${visibleClients.map((client) => `<div class="floating-action-row"><button class="row-action-button edit-button" data-edit="${escapeHtml(client.id)}" type="button">Edit</button><button class="row-action-button delete-button" data-delete="${escapeHtml(client.id)}" type="button">Delete</button></div>`).join('')}` : '';
  $('right-actions').innerHTML = visibleClients.length ? `<div class="floating-action-spacer" aria-hidden="true"></div>${visibleClients.map((client) => {
    const task = currentTask(client);
    const label = task?.type === 'eval' ? 'Eval submitted' : 'Progress submitted';
    return `<div class="floating-action-row"><button class="row-action-button submitted-button next-submission-button" data-submission="${task?.type || ''}" data-client-id="${escapeHtml(client.id)}" type="button"${task ? '' : ' disabled'}>${label}</button><button class="row-action-button history-button" data-history="${escapeHtml(client.id)}" type="button">History</button></div>`;
  }).join('')}` : '';
  $('empty-state').hidden = visibleClients.length > 0;
  $('empty-state').textContent = clients.length === 0 ? 'No clients added yet. Add one to start tracking report and evaluation due dates.' : 'No clients match this Medicaid filter.';
  $('table-wrap').hidden = visibleClients.length === 0;
  $('token-count').textContent = `${visibleClients.length} of ${clients.length} client${clients.length === 1 ? '' : 's'}`;
  document.querySelectorAll('.sort-button').forEach((button) => button.setAttribute('aria-sort', button.dataset.sort === sort.key ? sort.direction : 'none'));
  $('reset-sort-button').disabled = sort.key === defaultSort.key && sort.direction === defaultSort.direction;
}
async function save() { await window.tokenStore.save(clients); render(); }
function draftSchedule() { return createClientSchedule($('creation-date').value, appSettings.schedules[profileFor($('medicaid-client').value)]); }
function taskLabel(type) { return type === 'progress' ? 'progress reports' : 'evaluations'; }
function setIntakeView(view) {
  activeIntakeTab = view;
  const isExisting = view === 'existing';
  $('new-client-fields').hidden = isExisting;
  $('existing-client-fields').hidden = !isExisting;
  ['creation-date', 'next-progress-due', 'next-eval-due'].forEach((id) => { $(id).disabled = isExisting; });
  ['last-eval-date', 'last-progress-date', 'occurrence-choice'].forEach((id) => { $(id).disabled = !isExisting; });
  [['new-client-tab', 'new'], ['existing-client-tab', 'existing']].forEach(([id, tab]) => {
    const selected = tab === view;
    $(id).classList.toggle('is-active', selected);
    $(id).setAttribute('aria-selected', String(selected));
  });
  if (isExisting) updateEstablishedOptions();
}
function updateEstablishedOptions() {
  const lastEvaluationDate = $('last-eval-date').value;
  const lastProgressReportDate = $('last-progress-date').value;
  const field = $('occurrence-choice-field');
  const select = $('occurrence-choice');
  const previousValue = select.value;
  establishedOptions = null;
  field.hidden = true;
  select.innerHTML = '';
  if (!lastEvaluationDate) return;
  try {
    const options = establishedIntakeOptions(lastEvaluationDate, lastProgressReportDate, appSettings.schedules[profileFor($('medicaid-client').value)]);
    establishedOptions = options;
    if (!options.requiresChoice) {
      select.innerHTML = `<option value="${options.choices[0].value}">${options.choices[0].label}</option>`;
      return;
    }
    $('occurrence-choice-label').textContent = `How many ${taskLabel(options.latestType)} have been submitted since the last ${taskLabel(options.previousType).replace(/s$/, '')}?`;
    select.innerHTML = `<option value="">Select a number</option>${options.choices.map((choice) => `<option value="${choice.value}">${choice.label}</option>`).join('')}`;
    select.value = options.choices.some((choice) => choice.value === previousValue) ? previousValue : '';
    field.hidden = false;
  } catch (_) {
    // The form submit handler presents validation errors once all fields are complete.
  }
}
function updateDueDayLabels() {
  const creationDate = $('creation-date').value;
  const schedule = appSettings.schedules[profileFor($('medicaid-client').value)];
  const projected = creationDate && schedule ? projectedSchedule(createClientSchedule(creationDate, schedule)) : null;
  [['next-progress-due', 'next-progress-days', 'progress'], ['next-eval-due', 'next-eval-days', 'eval']].forEach(([inputId, labelId, type]) => {
    const date = $(inputId).value;
    const task = projected?.tasks.find((item) => item.type === type);
    const intervalText = task ? intervalLabel({ value: schedule.interval.value * (task.step + 1), unit: schedule.interval.unit }) : '';
    $(labelId).textContent = creationDate && date && intervalText ? `${intervalText} from initial eval` : '';
  });
}
function applyDefaultDueDates() {
  if (!$('creation-date').value) return;
  const schedule = draftSchedule();
  $('next-progress-due').value = schedule.nextProgressDue;
  $('next-eval-due').value = schedule.nextEvalDue;
  updateDueDayLabels();
}
async function openAddDialog() {
  if (dialog.open) return;
  editingClientId = null;
  $('dialog-eyebrow').textContent = 'NEW CLIENT'; $('dialog-title').textContent = 'Add a client'; $('save-client-button').textContent = 'Add client'; $('intake-tabs').hidden = false;
  $('creation-date-label').childNodes[0].textContent = 'Initial eval date';
  $('token-name').value = ''; $('creation-date').value = formatLocalDate(); $('medicaid-client').value = 'no'; $('last-eval-date').value = ''; $('last-progress-date').value = ''; establishedOptions = null; setIntakeView('new'); applyDefaultDueDates(); $('form-error').textContent = '';
  await window.tokenStore.focusWindow(); dialog.showModal(); setTimeout(() => $('token-name').focus(), 0);
}
function openEditDialog(client) {
  const upcoming = projection(client);
  editingClientId = client.id;
  $('dialog-eyebrow').textContent = 'EDIT CLIENT'; $('dialog-title').textContent = 'Edit client'; $('save-client-button').textContent = 'Save changes'; $('intake-tabs').hidden = true;
  $('creation-date-label').childNodes[0].textContent = client.intakeMode === 'existing' ? 'Last evaluation date' : 'Initial eval date';
  setIntakeView('new');
  $('token-name').value = client.name; $('medicaid-client').value = client.medicaidClient; $('creation-date').value = client.creationDate;
  $('next-progress-due').value = upcoming.progress?.dueDate || ''; $('next-eval-due').value = upcoming.eval?.dueDate || ''; updateDueDayLabels(); $('form-error').textContent = '';
  window.tokenStore.focusWindow().then(() => { dialog.showModal(); $('token-name').focus(); });
}
function openSubmissionDialog(client, type) {
  const task = currentTask(client); if (!task || task.type !== type) return;
  submissionClientId = client.id; submissionType = type;
  const label = type === 'progress' ? 'Progress report' : 'Evaluation';
  $('submission-eyebrow').textContent = type === 'progress' ? 'PROGRESS REPORT' : 'EVALUATION'; $('submission-dialog-title').textContent = `${label} submitted`;
  $('submission-schedule-note').textContent = `This will advance the cycle from the scheduled due date of ${readableDate(task.dueDate)}.`;
  $('submitted-date').value = formatLocalDate(); $('submission-form-error').textContent = '';
  window.tokenStore.focusWindow().then(() => { submissionDialog.showModal(); $('submitted-date').focus(); });
}
function openHistoryDialog(client) {
  const entries = (Array.isArray(client.submissionHistory) ? client.submissionHistory : []).map((entry, index) => ({ entry, index })).sort((a, b) => b.entry.submittedDate.localeCompare(a.entry.submittedDate) || b.index - a.index);
  const anchorLabel = client.intakeMode === 'existing' ? 'Last evaluation date' : 'Initial eval date';
  const initial = client.creationDate ? `<div class="history-entry"><span class="history-entry-type">${anchorLabel}</span><span class="history-entry-detail">${readableDate(client.creationDate)}</span></div>` : '';
  $('history-dialog-title').textContent = `${client.name} history`;
  $('history-list').innerHTML = initial + entries.map(({ entry }) => `<div class="history-entry"><span class="history-entry-type">${entry.type === 'eval' ? 'Evaluation' : 'Progress report'}${entry.estimated ? '<span class="history-entry-estimate">Estimated</span>' : ''}</span><span class="history-entry-detail">Due ${readableDate(entry.dueDate)}; submitted ${readableDate(entry.submittedDate)}</span></div>`).join('');
  window.tokenStore.focusWindow().then(() => historyDialog.showModal());
}

$('add-token-button').addEventListener('click', openAddDialog); $('medicaid-filter').addEventListener('change', render);
$('new-client-tab').addEventListener('click', () => setIntakeView('new'));
$('existing-client-tab').addEventListener('click', () => setIntakeView('existing'));
$('reset-sort-button').addEventListener('click', () => { sort = { ...defaultSort }; render(); });
['close-dialog', 'cancel-dialog'].forEach((id) => $(id).addEventListener('click', () => dialog.close()));
['close-delete-dialog', 'cancel-delete'].forEach((id) => $(id).addEventListener('click', () => deleteDialog.close('cancel')));
['close-submission-dialog', 'cancel-submission-dialog'].forEach((id) => $(id).addEventListener('click', () => submissionDialog.close()));
['close-history-dialog', 'close-history-button'].forEach((id) => $(id).addEventListener('click', () => historyDialog.close()));
[['next-progress-due'], ['next-eval-due']].forEach(([id]) => $(id).addEventListener('input', updateDueDayLabels));
$('creation-date').addEventListener('change', applyDefaultDueDates);
$('medicaid-client').addEventListener('change', () => { if (activeIntakeTab === 'existing') updateEstablishedOptions(); else applyDefaultDueDates(); });
['last-eval-date', 'last-progress-date'].forEach((id) => $(id).addEventListener('input', updateEstablishedOptions));
$('submission-form').addEventListener('submit', async (event) => { event.preventDefault(); const client = clients.find((item) => item.id === submissionClientId); if (!client || !$('submitted-date').value) { $('submission-form-error').textContent = 'Enter a valid submission date.'; return; } clients = clients.map((item) => item.id === client.id ? advanceSubmission(item, submissionType, $('submitted-date').value) : item); submissionClientId = null; submissionType = null; await save(); submissionDialog.close(); });
$('delete-form').addEventListener('submit', (event) => { event.preventDefault(); deleteDialog.close('confirm'); });
deleteDialog.addEventListener('close', () => { if (deleteDecision) { deleteDecision(deleteDialog.returnValue === 'confirm'); deleteDecision = null; } });
$('token-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('token-name').value.trim(); const medicaidClient = $('medicaid-client').value; const existing = clients.find((client) => client.id === editingClientId);
  if (!existing && activeIntakeTab === 'existing') {
    const lastEvaluationDate = $('last-eval-date').value;
    const lastProgressReportDate = $('last-progress-date').value;
    if (!name || !lastEvaluationDate) { $('form-error').textContent = 'Enter a client name and last evaluation date.'; return; }
    let scheduled;
    try {
      const options = establishedIntakeOptions(lastEvaluationDate, lastProgressReportDate, appSettings.schedules[profileFor(medicaidClient)]);
      if (options.requiresChoice && !$('occurrence-choice').value) { $('form-error').textContent = 'Choose how many submissions have been made in this part of the cycle.'; return; }
      scheduled = createEstablishedClientSchedule(lastEvaluationDate, lastProgressReportDate, appSettings.schedules[profileFor(medicaidClient)], $('occurrence-choice').value);
    } catch (error) { $('form-error').textContent = error.message; return; }
    clients.push({ id: crypto.randomUUID(), ...scheduled, name, medicaidClient, creationDate: lastEvaluationDate, intakeMode: 'existing' });
    await save(); dialog.close(); return;
  }
  const creationDate = $('creation-date').value;
  if (!name || !creationDate || !$('next-progress-due').value || !$('next-eval-due').value) { $('form-error').textContent = 'Enter a client name, initial eval date, and both due dates.'; return; }
  const reset = !existing || existing.medicaidClient !== medicaidClient || existing.creationDate !== creationDate;
  let scheduled = reset ? createClientSchedule(creationDate, appSettings.schedules[profileFor(medicaidClient)]) : { ...existing, dueOverrides: {} };
  try { scheduled = setScheduleOverride(scheduled, 'progress', $('next-progress-due').value); scheduled = setScheduleOverride(scheduled, 'eval', $('next-eval-due').value); } catch (error) { $('form-error').textContent = error.message; return; }
  const details = { ...scheduled, name, medicaidClient, creationDate, intakeMode: existing?.intakeMode || 'new', submissionHistory: existing?.submissionHistory || [] };
  if (existing) clients = clients.map((client) => client.id === existing.id ? { ...client, ...details } : client); else clients.push({ id: crypto.randomUUID(), ...details });
  editingClientId = null; await save(); dialog.close();
});
document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => { if (sort.key === button.dataset.sort) sort.direction = sort.direction === 'ascending' ? 'descending' : 'ascending'; else sort = { key: button.dataset.sort, direction: 'ascending' }; render(); }));
$('client-workspace').addEventListener('click', async (event) => {
  const submit = event.target.closest('[data-submission]'); if (submit) { const client = clients.find((item) => item.id === submit.dataset.clientId); if (client) openSubmissionDialog(client, submit.dataset.submission); return; }
  const history = event.target.closest('[data-history]'); if (history) { const client = clients.find((item) => item.id === history.dataset.history); if (client) openHistoryDialog(client); return; }
  const edit = event.target.closest('[data-edit]'); if (edit) { const client = clients.find((item) => item.id === edit.dataset.edit); if (client) openEditDialog(client); return; }
  const remove = event.target.closest('[data-delete]'); if (!remove) return; const client = clients.find((item) => item.id === remove.dataset.delete);
  if (client && await new Promise((resolve) => { deleteDecision = resolve; $('delete-message').textContent = `This will remove “${client.name}” from your client list.`; deleteDialog.showModal(); })) { clients = clients.filter((item) => item.id !== client.id); await save(); }
});
function isCurrentClient(client) { return client && typeof client.id === 'string' && typeof client.name === 'string' && typeof client.nextProgressDue === 'string' && typeof client.nextEvalDue === 'string' && Array.isArray(client.submissionHistory); }
async function loadClients() { try { appSettings = await loadAndApplyTheme(); const loaded = await window.tokenStore.load(); clients = (Array.isArray(loaded) ? loaded : []).filter(isCurrentClient); } catch (_) { clients = []; } render(); }
loadClients();
