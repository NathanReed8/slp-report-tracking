let clients = [];
let calendarView = 'week';
let calendarAnchor = new Date();
let submissionClientId = null;
let submissionType = null;
const $ = (id) => document.getElementById(id);
const submissionDialog = $('submission-dialog');
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function readableDate(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function dateKey(date) { return formatLocalDate(date); }
function startOfWeek(date) { const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()); start.setDate(start.getDate() - start.getDay()); return start; }
function addDays(date, amount) { const result = new Date(date.getFullYear(), date.getMonth(), date.getDate()); result.setDate(result.getDate() + amount); return result; }
function calendarEvents() {
  const events = []; const completed = new Set();
  clients.forEach((client) => (Array.isArray(client.submissionHistory) ? client.submissionHistory : []).forEach((entry) => {
    if (!entry || !['progress', 'eval'].includes(entry.type) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.dueDate || '')) return;
    const key = `${client.id}-${entry.type}-${entry.dueDate}`; if (completed.has(key)) return; completed.add(key); events.push({ client, type: entry.type, dueDate: entry.dueDate, completed: true, current: false });
  }));
  clients.forEach((client) => {
    const schedule = projectedSchedule(client);
    [schedule.progress, schedule.eval].filter(Boolean).forEach((task) => {
    const key = `${client.id}-${task.type}-${task.dueDate}`;
    if (!completed.has(key)) events.push({ client, type: task.type, dueDate: task.dueDate, completed: false, current: task.isCurrent });
    });
  });
  return events.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.client.name.localeCompare(b.client.name));
}
function calendarEventMarkup(item) {
  const label = `${item.client.name} ${item.type === 'progress' ? 'Progress report' : 'Evaluation'} due`;
  const classes = `calendar-event ${item.type === 'progress' ? 'calendar-event-progress' : 'calendar-event-eval'}${item.completed ? ' is-completed' : ''}`;
  const contents = `${item.completed ? '<span class="calendar-check" aria-hidden="true">✓</span>' : ''}<span>${escapeHtml(label)}</span>`;
  if (item.completed || !item.current) return `<div class="${classes}" title="${item.completed ? 'Completed' : 'Upcoming task'}">${contents}</div>`;
  return `<button class="${classes}" data-calendar-submission="${item.type}" data-client-id="${escapeHtml(item.client.id)}" type="button" title="Mark ${escapeHtml(label)} as completed">${contents}</button>`;
}
function calendarDayMarkup(date, events, isMonthCell = false) {
  const key = dateKey(date); const today = key === formatLocalDate(); const monthClass = isMonthCell && date.getMonth() !== calendarAnchor.getMonth() ? ' is-outside-month' : '';
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }); const dayEvents = events.filter((item) => item.dueDate === key);
  return `<article class="calendar-day${today ? ' is-today' : ''}${monthClass}"><div class="calendar-day-heading"><span class="calendar-weekday">${isMonthCell ? '' : weekday}</span><time datetime="${key}">${date.getDate()}</time></div><div class="calendar-events">${dayEvents.map(calendarEventMarkup).join('')}</div></article>`;
}
function renderCalendar() {
  const grid = $('calendar-grid'); const events = calendarEvents();
  if (calendarView === 'week') {
    const start = startOfWeek(calendarAnchor); const end = addDays(start, 6); const formatOptions = { month: 'short', day: 'numeric' };
    $('calendar-period-label').textContent = `${start.toLocaleDateString(undefined, formatOptions)} – ${end.toLocaleDateString(undefined, { ...formatOptions, year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined })}`;
    grid.className = 'calendar-grid calendar-week-grid'; grid.innerHTML = Array.from({ length: 7 }, (_, index) => calendarDayMarkup(addDays(start, index), events)).join('');
  } else {
    const firstDay = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth(), 1); const gridStart = startOfWeek(firstDay);
    $('calendar-period-label').textContent = calendarAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div class="calendar-month-weekday">${day}</div>`).join('');
    grid.className = 'calendar-grid calendar-month-grid'; grid.innerHTML = headers + Array.from({ length: 42 }, (_, index) => calendarDayMarkup(addDays(gridStart, index), events, true)).join('');
  }
  document.querySelectorAll('[data-calendar-view]').forEach((button) => { const selected = button.dataset.calendarView === calendarView; button.classList.toggle('is-active', selected); button.setAttribute('aria-pressed', String(selected)); });
}
function openSubmissionDialog(client, type) {
  const task = projectedSchedule(client).current; if (!task || task.type !== type) return;
  submissionClientId = client.id; submissionType = type; const label = type === 'progress' ? 'Progress report' : 'Evaluation';
  $('submission-eyebrow').textContent = type === 'progress' ? 'PROGRESS REPORT' : 'EVALUATION'; $('submission-dialog-title').textContent = `${label} submitted`;
  $('submission-schedule-note').textContent = `This will advance the cycle from the scheduled due date of ${readableDate(task.dueDate)}.`;
  $('submitted-date').value = formatLocalDate(); $('submission-form-error').textContent = ''; window.tokenStore.focusWindow().then(() => { submissionDialog.showModal(); $('submitted-date').focus(); });
}
async function save() { await window.tokenStore.save(clients); renderCalendar(); }
['close-submission-dialog', 'cancel-submission-dialog'].forEach((id) => $(id).addEventListener('click', () => submissionDialog.close()));
document.querySelectorAll('[data-calendar-view]').forEach((button) => button.addEventListener('click', () => { calendarView = button.dataset.calendarView; renderCalendar(); }));
$('calendar-previous').addEventListener('click', () => { calendarAnchor = calendarView === 'week' ? addDays(calendarAnchor, -7) : new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() - 1, 1); renderCalendar(); });
$('calendar-next').addEventListener('click', () => { calendarAnchor = calendarView === 'week' ? addDays(calendarAnchor, 7) : new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 1); renderCalendar(); });
$('calendar-today').addEventListener('click', () => { calendarAnchor = new Date(); renderCalendar(); });
$('calendar-grid').addEventListener('click', (event) => { const button = event.target.closest('[data-calendar-submission]'); if (!button) return; const client = clients.find((item) => item.id === button.dataset.clientId); if (client) openSubmissionDialog(client, button.dataset.calendarSubmission); });
$('submission-form').addEventListener('submit', async (event) => { event.preventDefault(); const client = clients.find((item) => item.id === submissionClientId); if (!client || !$('submitted-date').value) { $('submission-form-error').textContent = 'Enter a valid submission date.'; return; } clients = clients.map((item) => item.id === client.id ? advanceSubmission(item, submissionType, $('submitted-date').value) : item); submissionClientId = null; submissionType = null; await save(); submissionDialog.close(); });
function isCurrentClient(client) { return client && typeof client.id === 'string' && typeof client.name === 'string' && typeof client.nextProgressDue === 'string' && typeof client.nextEvalDue === 'string' && Array.isArray(client.submissionHistory); }
async function loadClients() { try { await loadAndApplyTheme(); const loaded = await window.tokenStore.load(); clients = (Array.isArray(loaded) ? loaded : []).filter(isCurrentClient); } catch (_) { clients = []; } renderCalendar(); }
loadClients();
