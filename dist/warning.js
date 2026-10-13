// src/warning.js
var errorMessage = document.querySelector("#error");
var continueButton = document.querySelector("#continue");
var closeButton = document.querySelector("#close");
var confirmation = document.querySelector("#confirmation");
var tab = await chrome.tabs.getCurrent();
if (!tab?.id) {
  showError("ClickNix could not identify this warning tab.");
} else {
  const stateKey = `tab:${tab.id}`;
  await renderStoredRecord(stateKey);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session" && changes[stateKey]?.newValue) {
      renderRecord(changes[stateKey].newValue);
    }
  });
}
continueButton.addEventListener("click", async () => {
  if (!confirmation.open) {
    return;
  }
  continueButton.disabled = true;
  errorMessage.hidden = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "continue-warning" });
    if (response?.ok !== true) {
      throw new Error(response?.error || "The site could not be continued.");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
});
closeButton.addEventListener("click", async () => {
  closeButton.disabled = true;
  try {
    if (!tab?.id) {
      throw new Error("ClickNix could not identify this warning tab. Please close it manually.");
    }
    await chrome.tabs.remove(tab.id);
  } catch (error) {
    closeButton.disabled = false;
    showError(error instanceof Error ? error.message : String(error));
  }
});
async function renderStoredRecord(stateKey) {
  const record = (await chrome.storage.session.get(stateKey))[stateKey];
  renderRecord(record);
}
function renderRecord(record) {
  if (!record?.matches?.length) {
    showError("ClickNix could not load the detection that opened this warning.");
    return;
  }
  errorMessage.hidden = true;
  continueButton.disabled = false;
}
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  continueButton.disabled = true;
}
