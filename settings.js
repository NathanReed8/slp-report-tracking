let settings = defaultSettings();
let draggedCycleItem = null;
let savedSettings = clone(settings);
let pendingNavigation = null;

const $ = (id) => document.getElementById(id);
const intervalProfiles = $('interval-profiles');
const cycleProfiles = $('cycle-profiles');
const profileTitles = { medicaid: 'Medicaid clients', nonMedicaid: 'Non-Medicaid clients' };

function colorLabel(role) {
  return { clientsAdd: 'Add client', clientsReset: 'Reset sort', clientsSort: 'Sort columns', clientsEdit: 'Edit client', clientsDelete: 'Delete client', clientsProgress: 'Progress report submitted', clientsEvaluation: 'Evaluation submitted', clientsHistory: 'History', calendarManageClients: 'Manage clients', calendarToday: 'Today', calendarNavigation: 'Previous / next period', calendarView: 'Week / month toggle', calendarProgress: 'Progress report event', calendarEvaluation: 'Evaluation event' }[role];
}
function renderColors() {
  $('color-controls').innerHTML = Object.entries(BUTTON_COLOR_GROUPS).map(([group, roles]) => `<fieldset class="color-group"><legend>${group === 'clients' ? 'Clients tab' : 'Calendar tab'}</legend>${roles.map((role) => {
    const value = settings.colorOverrides[role] || THEME_PALETTES[settings.theme][role];
    return `<label class="color-control"><span>${colorLabel(role)}</span><input data-color-role="${role}" type="color" value="${value}"><output>${value.toUpperCase()}</output></label>`;
  }).join('')}</fieldset>`).join('');
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
}
function intervalProfile(profileKey) {
  const value = settings.schedules[profileKey].interval;
  return `<section class="schedule-profile" aria-labelledby="${profileKey}-interval-heading"><h2 id="${profileKey}-interval-heading">${profileTitles[profileKey]}</h2><label class="interval-row"><span class="interval-label">One progress report / eval every</span><input data-profile="${profileKey}" data-interval-part="value" type="number" min="1" step="1" value="${value.value}" aria-label="Interval value"><select data-profile="${profileKey}" data-interval-part="unit" aria-label="Interval unit">${['days', 'weeks', 'months'].map((unit) => `<option value="${unit}"${unit === value.unit ? ' selected' : ''}>${unit[0].toUpperCase()}${unit.slice(1)}</option>`).join('')}</select></label></section>`;
}
function taskLabel(type) { return type === 'progress' ? 'Progress report' : 'Evaluation'; }
function cycleProfile(profileKey) {
  const cycle = settings.schedules[profileKey].cycle;
  return `<section class="schedule-profile" aria-labelledby="${profileKey}-cycle-heading"><h2 id="${profileKey}-cycle-heading">${profileTitles[profileKey]}</h2><p class="cycle-help">Drag progress report / eval items into order. The sequence repeats after the final item.</p><ol class="cycle-list" data-cycle-profile="${profileKey}">${cycle.map((type, index) => `<li class="cycle-item" draggable="true" data-profile="${profileKey}" data-index="${index}"><span class="drag-handle" aria-hidden="true">⠿</span><span class="cycle-task-label">${taskLabel(type)}</span><div class="cycle-buttons"><button data-cycle-action="move-up" data-profile="${profileKey}" data-index="${index}" class="interval-button" type="button" aria-label="Move ${taskLabel(type)} up">↑</button><button data-cycle-action="move-down" data-profile="${profileKey}" data-index="${index}" class="interval-button" type="button" aria-label="Move ${taskLabel(type)} down">↓</button><button data-cycle-action="remove" data-profile="${profileKey}" data-index="${index}" class="interval-button" type="button" aria-label="Remove ${taskLabel(type)}">×</button></div></li>`).join('')}</ol><div class="cycle-add-actions"><button data-cycle-action="add" data-profile="${profileKey}" data-type="progress" class="add-interval-button" type="button">+ Progress report</button><button data-cycle-action="add" data-profile="${profileKey}" data-type="eval" class="add-interval-button" type="button">+ Evaluation</button></div></section>`;
}
function renderSchedules() { intervalProfiles.innerHTML = ['medicaid', 'nonMedicaid'].map(intervalProfile).join(''); cycleProfiles.innerHTML = ['medicaid', 'nonMedicaid'].map(cycleProfile).join(''); }
function render() { renderColors(); renderSchedules(); applyTheme(settings); }
function hasUnsavedChanges() { return JSON.stringify(settings) !== JSON.stringify(savedSettings); }
function moveCycleItem(profileKey, from, to) {
  const cycle = settings.schedules[profileKey].cycle;
  if (to < 0 || to >= cycle.length || from === to) return;
  const [item] = cycle.splice(from, 1);
  cycle.splice(to, 0, item);
}
function canRemove(profileKey, index) { const cycle = settings.schedules[profileKey].cycle; return cycle.filter((item) => item === cycle[index]).length > 1; }
function clearDropIndicator() {
  cycleProfiles.querySelectorAll('.is-drop-before, .is-drop-after').forEach((item) => item.classList.remove('is-drop-before', 'is-drop-after'));
  cycleProfiles.querySelectorAll('.is-drop-active').forEach((list) => list.classList.remove('is-drop-active'));
}
function insertionPoint(list, clientY) {
  const items = [...list.querySelectorAll('.cycle-item')];
  const index = items.findIndex((item) => clientY < item.getBoundingClientRect().top + (item.getBoundingClientRect().height / 2));
  return { items, index: index < 0 ? items.length : index };
}
function showDropIndicator(list, clientY) {
  const { items, index } = insertionPoint(list, clientY);
  clearDropIndicator();
  list.classList.add('is-drop-active');
  if (index < items.length) items[index].classList.add('is-drop-before');
  else items.at(-1)?.classList.add('is-drop-after');
  return index;
}
function actOnCycle(button) {
  const profileKey = button.dataset.profile;
  const cycle = settings.schedules[profileKey].cycle;
  const index = Number(button.dataset.index);
  if (button.dataset.cycleAction === 'add') cycle.push(button.dataset.type);
  if (button.dataset.cycleAction === 'remove' && canRemove(profileKey, index)) cycle.splice(index, 1);
  if (button.dataset.cycleAction === 'move-up') moveCycleItem(profileKey, index, index - 1);
  if (button.dataset.cycleAction === 'move-down') moveCycleItem(profileKey, index, index + 1);
  renderSchedules();
}

$('color-controls').addEventListener('input', (event) => {
  const role = event.target.dataset.colorRole;
  if (!role) return;
  settings.colorOverrides[role] = event.target.value;
  event.target.nextElementSibling.textContent = event.target.value.toUpperCase();
  applyTheme(settings);
});
document.querySelectorAll('input[name="theme"]').forEach((input) => input.addEventListener('change', () => { settings.theme = input.value; renderColors(); applyTheme(settings); }));
function updateInterval(event) {
  const part = event.target.dataset.intervalPart;
  if (part) settings.schedules[event.target.dataset.profile].interval[part] = part === 'value' ? Number(event.target.value) : event.target.value;
}
intervalProfiles.addEventListener('input', updateInterval);
intervalProfiles.addEventListener('change', updateInterval);
cycleProfiles.addEventListener('click', (event) => { const button = event.target.closest('[data-cycle-action]'); if (button) actOnCycle(button); });
cycleProfiles.addEventListener('dragstart', (event) => {
  const item = event.target.closest('.cycle-item');
  if (!item) return;
  draggedCycleItem = { profile: item.dataset.profile, index: Number(item.dataset.index) };
  event.dataTransfer.setData('text/plain', 'cycle-task');
  event.dataTransfer.effectAllowed = 'move';
  item.classList.add('is-dragging');
});
cycleProfiles.addEventListener('dragend', (event) => { event.target.closest('.cycle-item')?.classList.remove('is-dragging'); draggedCycleItem = null; clearDropIndicator(); });
cycleProfiles.addEventListener('dragover', (event) => {
  const list = event.target.closest('.cycle-list');
  if (!list || !draggedCycleItem || list.dataset.cycleProfile !== draggedCycleItem.profile) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  showDropIndicator(list, event.clientY);
});
cycleProfiles.addEventListener('dragleave', (event) => {
  const list = event.target.closest('.cycle-list');
  if (list && !list.contains(event.relatedTarget)) clearDropIndicator();
});
cycleProfiles.addEventListener('drop', (event) => {
  const list = event.target.closest('.cycle-list');
  if (!list || !draggedCycleItem || draggedCycleItem.profile !== list.dataset.cycleProfile) return;
  event.preventDefault();
  const insertionIndex = insertionPoint(list, event.clientY).index;
  const destination = insertionIndex > draggedCycleItem.index ? insertionIndex - 1 : insertionIndex;
  moveCycleItem(draggedCycleItem.profile, draggedCycleItem.index, destination);
  draggedCycleItem = null;
  clearDropIndicator();
  renderSchedules();
});
$('reset-colors').addEventListener('click', () => { settings.colorOverrides = {}; renderColors(); applyTheme(settings); });
$('restore-defaults').addEventListener('click', () => { settings = defaultSettings(); $('settings-error').textContent = ''; $('settings-error').classList.remove('is-error'); render(); });
window.tokenStore.appVersion().then((version) => { $('installed-version').textContent = version; }).catch(() => { $('installed-version').textContent = 'Unavailable'; });
$('check-for-updates').addEventListener('click', async () => {
  const button = $('check-for-updates');
  const status = $('update-status');
  button.disabled = true;
  status.classList.remove('is-error');
  status.textContent = 'Checking for updates…';
  try {
    const result = await window.tokenStore.checkForUpdates();
    if (result.status === 'development') status.textContent = 'Update checks require an installed release.';
    else if (result.status === 'up-to-date') status.textContent = `You’re up to date (${result.version}).`;
    else if (result.status === 'available') status.textContent = `Version ${result.version} is available.`;
    else throw new Error('Update check failed');
  } catch (error) {
    status.classList.add('is-error');
    status.textContent = 'Could not check for updates. Please try again later.';
  } finally {
    button.disabled = false;
  }
});
async function saveSettings() {
  if (!isSettings(settings)) {
    $('settings-error').textContent = 'Enter a positive whole-number interval and keep at least one progress report and evaluation in every cycle.';
    $('settings-error').classList.add('is-error');
    return false;
  }
  const storedClients = await window.tokenStore.load();
  const updatedClients = (Array.isArray(storedClients) ? storedClients : []).map((client) => hasScheduleSnapshot(client) ? reanchorSchedule(client, settings.schedules[profileFor(client.medicaidClient)]) : client);
  await Promise.all([window.tokenStore.saveSettings(settings), window.tokenStore.save(updatedClients)]);
  savedSettings = clone(settings);
  $('settings-error').textContent = 'Settings saved and active client schedules updated.';
  $('settings-error').classList.remove('is-error');
  applyTheme(settings);
  return true;
}
$('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveSettings();
});

document.querySelectorAll('a[href]').forEach((link) => link.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const destination = new URL(link.href, window.location.href);
  if (destination.pathname === window.location.pathname || !hasUnsavedChanges()) return;
  event.preventDefault();
  pendingNavigation = destination.href;
  $('unsaved-settings-dialog').showModal();
}));

$('cancel-leave-settings').addEventListener('click', () => { pendingNavigation = null; $('unsaved-settings-dialog').close(); });
$('discard-settings').addEventListener('click', () => {
  const destination = pendingNavigation;
  pendingNavigation = null;
  // The draft is intentionally being abandoned, so do not trigger the native
  // beforeunload warning while completing this confirmed navigation.
  savedSettings = clone(settings);
  $('unsaved-settings-dialog').close();
  if (destination) window.location.assign(destination);
});
$('save-settings-before-leaving').addEventListener('click', async () => {
  if (!await saveSettings()) return;
  const destination = pendingNavigation;
  pendingNavigation = null;
  $('unsaved-settings-dialog').close();
  if (destination) window.location.assign(destination);
});
window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
});
loadAndApplyTheme().then((saved) => { settings = clone(saved); savedSettings = clone(saved); render(); });
