function createUpdateChecker({ updater, isPackaged, getVersion }) {
  let pendingCheck = null;

  return function checkForUpdates() {
    if (!isPackaged()) return Promise.resolve({ status: 'development' });
    if (pendingCheck) return pendingCheck;

    pendingCheck = new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        updater.removeListener('update-available', onAvailable);
        updater.removeListener('update-not-available', onNotAvailable);
        updater.removeListener('error', onError);
      };
      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const onAvailable = (update) => finish({ status: 'available', version: update.version });
      const onNotAvailable = () => finish({ status: 'up-to-date', version: getVersion() });
      const onError = () => finish({ status: 'error' });

      updater.once('update-available', onAvailable);
      updater.once('update-not-available', onNotAvailable);
      updater.once('error', onError);
      Promise.resolve().then(() => updater.checkForUpdates()).catch(onError);
    }).finally(() => { pendingCheck = null; });

    return pendingCheck;
  };
}

module.exports = { createUpdateChecker };
