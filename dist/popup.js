// src/popup.js
var status = document.querySelector("#status");
var REFRESH_MS = 500;
var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!tab?.id) {
  status.textContent = "No active tab";
} else {
  await showTabStatus(tab.id);
}
async function showTabStatus(tabId) {
  const stateKey = `tab:${tabId}`;
  const [stored, statusResponse, scannable] = await Promise.all([
    chrome.storage.session.get(stateKey),
    readScannerStatus(tabId),
    hasContentScripts(tabId)
  ]);
  const record = stored[stateKey];
  const scannerStatus = statusResponse?.scannerStatus;
  const hasMatches = Boolean(record?.matches?.length);
  const scanned = record?.scanned === true || Boolean(record?.scanFailure);
  const complete = scanned && !statusResponse?.scanning;
  status.className = "";
  if (scannerStatus?.state !== "ready" && !hasMatches) {
    status.textContent = scannerStatus?.state === "failed" ? "ClickNix couldn't start. Restarting the browser usually fixes this." : "ClickNix is starting up.";
    status.classList.add("incomplete");
  } else if (hasMatches) {
    status.textContent = "This tab was flagged: known threat pattern detected.";
    status.classList.add("flagged");
  } else if (!scannable) {
    status.textContent = "ClickNix doesn't scan this page.";
  } else if (!complete) {
    status.textContent = scanned ? "Scanning this tab. No threats found so far." : "Waiting for this tab to be scanned.";
    status.classList.add("incomplete");
  } else {
    status.textContent = "Scan complete. No threats found.";
  }
  if (!hasMatches && !(complete && scannerStatus?.state === "ready")) {
    setTimeout(() => void showTabStatus(tabId), REFRESH_MS);
  }
}
async function readScannerStatus(tabId) {
  try {
    return await chrome.runtime.sendMessage({ type: "get-scanner-status", tabId });
  } catch {
    return {
      scannerStatus: { state: "failed" }
    };
  }
}
async function hasContentScripts(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "popup-probe" }, { frameId: 0 });
    return true;
  } catch (error) {
    return !String(error?.message).includes("Receiving end does not exist");
  }
}
