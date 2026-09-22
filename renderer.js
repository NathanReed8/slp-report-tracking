let clients = [];
let sort = { key: 'expiryDate', direction: 'ascending' };

const $ = (id) => document.getElementById(id);
const dialog = $('token-dialog');
const deleteDialog = $('delete-dialog');
let deleteDecision = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function readableDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function sortedClients() {
  return [...clients].sort((a, b) => {
    const aDays = daysRemaining(a.expiryDate);
    const bDays = daysRemaining(b.expiryDate);
    let result;
    if (sort.key === 'name') result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    else if (sort.key === 'daysRemaining') result = aDays - bDays;
    else result = a.expiryDate.localeCompare(b.expiryDate);
    if (result === 0) result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return sort.direction === 'ascending' ? result : -result;
  });
}

function render() {
  const rows = $('token-rows');
  rows.innerHTML = sortedClients().map((client) => {
    const remaining = daysRemaining(client.expiryDate);
    const status = statusForDays(remaining);
    const icon = remaining <= 0 ? `<svg class="status-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.1v4.2M8 10.9v.2" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>` : '';
    return `<tr><td>${escapeHtml(client.name)}</td><td class="report-cell"><span class="report-date">${readableDate(client.expiryDate)}</span><span class="status-pill ${status.className}" aria-label="${status.label}: ${remaining} days until report">${icon}${remaining} days</span></td><td><button class="delete-button" data-delete="${escapeHtml(client.id)}" type="button">Delete</button></td></tr>`;
  }).join('');
  $('empty-state').hidden = clients.length > 0;
  $('table-wrap').hidden = clients.length === 0;
  $('token-count').textContent = `${clients.length} client${clients.length === 1 ? '' : 's'}`;
  document.querySelectorAll('.sort-button').forEach((button) => button.setAttribute('aria-sort', button.dataset.sort === sort.key ? sort.direction : 'none'));
}

async function save() { await window.tokenStore.save(clients); render(); }

async function openDialog() {
  if (dialog.open) return;
  $('creation-date').value = formatLocalDate();
  $('duration').value = '90';
  $('duration-unit').value = 'days';
  $('form-error').textContent = '';
  $('token-name').value = '';
  await window.tokenStore.focusWindow();
  dialog.showModal();
  setTimeout(async () => {
    await window.tokenStore.focusWindow();
    $('token-name').focus();
  }, 0);
}

$('add-token-button').addEventListener('click', openDialog);
$('close-dialog').addEventListener('click', () => dialog.close());
$('cancel-dialog').addEventListener('click', () => dialog.close());
$('close-delete-dialog').addEventListener('click', () => deleteDialog.close('cancel'));
$('cancel-delete').addEventListener('click', () => deleteDialog.close('cancel'));
$('delete-form').addEventListener('submit', (event) => {
  event.preventDefault();
  deleteDialog.close('confirm');
});
deleteDialog.addEventListener('close', () => {
  if (deleteDecision) {
    deleteDecision(deleteDialog.returnValue === 'confirm');
    deleteDecision = null;
  }
});
$('token-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('token-name').value.trim();
  const creationDate = $('creation-date').value;
  const duration = Number($('duration').value);
  const unit = $('duration-unit').value;
  if (!name || !creationDate || !Number.isInteger(duration) || duration <= 0) { $('form-error').textContent = 'Enter a client name, valid start date, and positive whole-number duration.'; return; }
  clients.push({ id: crypto.randomUUID(), name, creationDate, duration, unit, expiryDate: addDuration(creationDate, duration, unit) });
  await save(); dialog.close();
});

document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => {
  if (sort.key === button.dataset.sort) sort.direction = sort.direction === 'ascending' ? 'descending' : 'ascending';
  else { sort.key = button.dataset.sort; sort.direction = 'ascending'; }
  render();
}));

$('token-rows').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  const client = clients.find((item) => item.id === button.dataset.delete);
  if (client && await new Promise((resolve) => {
    deleteDecision = resolve;
    $('delete-message').textContent = `This will remove “${client.name}” from your client list.`;
    deleteDialog.showModal();
  })) {
    clients = clients.filter((item) => item.id !== client.id);
    await save();
    await window.tokenStore.focusWindow();
  }
});

window.tokenStore.load().then((loaded) => { clients = Array.isArray(loaded) ? loaded : []; render(); }).catch(() => { render(); });
