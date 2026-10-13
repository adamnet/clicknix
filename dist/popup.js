// src/popup.js
var status = document.querySelector("#status");
var SCANNING_REFRESH_MS = 500;
var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!tab?.id) {
  status.textContent = "No active tab";
} else {
  await showTabStatus(tab.id);
}
async function showTabStatus(tabId) {
  const stateKey = `tab:${tabId}`;
  const [stored, statusResponse] = await Promise.all([
    chrome.storage.session.get(stateKey),
    readScannerStatus(tabId)
  ]);
  const record = stored[stateKey];
  const scannerStatus = statusResponse?.scannerStatus;
  const hasMatches = Boolean(record?.matches?.length);
  status.className = "";
  if (scannerStatus?.state !== "ready" && !hasMatches) {
    status.textContent = scannerStatus?.state === "failed" ? `Scanner unavailable: ${scannerStatus.error}` : "Scanner initialization is still in progress.";
    status.classList.add("incomplete");
  } else if (record?.scanFailure) {
    status.textContent = hasMatches ? "This tab was flagged, but part of the scan failed." : `Scan incomplete: ${record.scanFailure.message}`;
    status.classList.add("incomplete");
  } else if (hasMatches) {
    status.textContent = "This tab was flagged: known threat pattern detected.";
    status.classList.add("flagged");
  } else if (record?.scanned !== true || statusResponse?.scanning) {
    status.textContent = record?.scanned === true ? "Scanning this tab. No threats found so far." : "Waiting for this tab to be scanned.";
    status.classList.add("incomplete");
  } else {
    status.textContent = "Scan complete. No threats found.";
  }
  if (!hasMatches && statusResponse?.scanning) {
    setTimeout(() => void showTabStatus(tabId), SCANNING_REFRESH_MS);
  }
}
async function readScannerStatus(tabId) {
  try {
    return await chrome.runtime.sendMessage({ type: "get-scanner-status", tabId });
  } catch (error) {
    return {
      scannerStatus: {
        state: "failed",
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
