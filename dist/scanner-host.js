// src/scanner-protocol.js
var SCANNER_TARGETS = Object.freeze({
  HOST: "scanner-host"
});
var SCANNER_REQUESTS = Object.freeze({
  INITIALIZE: "initialize",
  SCAN: "scan",
  STATUS: "status"
});
var SCANNER_WORKER_MESSAGES = Object.freeze({
  INITIALIZED: "initialized",
  INITIALIZATION_FAILED: "initialization-failed",
  SCAN: "scan",
  SCAN_FAILED: "scan-failed",
  SCAN_RESULT: "scan-result"
});
var SCANNER_FAILURE_CODES = Object.freeze({
  HOST_UNAVAILABLE: "host-unavailable",
  INITIALIZATION_FAILED: "initialization-failed",
  INVALID_REQUEST: "invalid-request",
  INVALID_SCAN_RESULT: "invalid-scan-result",
  OVERLAPPING_SCAN: "overlapping-scan",
  RESULT_PROCESSING_FAILED: "result-processing-failed",
  RESULT_TRANSPORT_FAILED: "result-transport-failed",
  SCAN_TIMEOUT: "scan-timeout",
  WORKER_CRASHED: "worker-crashed",
  WORKER_UNAVAILABLE: "worker-unavailable",
  YARA_SCAN_EXCEPTION: "yara-scan-exception"
});
var SCANNER_TIMEOUTS = Object.freeze({
  INITIALIZE_MS: 6e4,
  SCAN_MS: 3e4
});
function createScannerFailure({
  code,
  stage,
  message,
  terminal = false,
  retryable = false
}) {
  return {
    code,
    stage,
    message: String(message),
    terminal: terminal === true,
    retryable: retryable === true
  };
}
function isScannerFailure(value) {
  return Boolean(
    value && typeof value === "object" && typeof value.code === "string" && typeof value.stage === "string" && typeof value.message === "string" && typeof value.terminal === "boolean" && typeof value.retryable === "boolean"
  );
}

// src/scanner-host.js
var worker;
var workerHasScanned = false;
var nextWorkerRequestId = 1;
var activeScan;
var scannerStatus;
var initialization;
var settleInitialization;
var initializationTimer;
var deliveredPayload;
var payloadWaiter;
startWorker();
navigator.serviceWorker.addEventListener("message", (event) => {
  const { requestId, payload } = event.data || {};
  if (typeof requestId !== "string" || !(payload instanceof ArrayBuffer)) {
    return;
  }
  if (payloadWaiter?.requestId === requestId) {
    payloadWaiter.resolve(payload);
    payloadWaiter = void 0;
    return;
  }
  deliveredPayload = { requestId, payload };
});
navigator.serviceWorker.startMessages();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== SCANNER_TARGETS.HOST) {
    return false;
  }
  void handleRequest(message).then((response) => sendResponse({ ok: true, ...response })).catch((error) => sendResponse({
    ok: false,
    failure: failureFromError(error)
  }));
  return true;
});
function startWorker() {
  scannerStatus = { state: "initializing" };
  workerHasScanned = false;
  initialization = new Promise((resolve) => {
    settleInitialization = resolve;
  });
  const instance = new Worker(chrome.runtime.getURL("scanner-worker.js"), {
    name: "clicknix-yara",
    type: "module"
  });
  worker = instance;
  const fromCurrentWorker = (handler) => (event) => {
    if (worker === instance) {
      handler(event);
    }
  };
  instance.addEventListener("message", fromCurrentWorker(handleWorkerMessage));
  instance.addEventListener("error", fromCurrentWorker((event) => stopWorker(crashFailure(
    "worker-runtime",
    event.message || "YARA-X worker failed"
  ))));
  instance.addEventListener("messageerror", fromCurrentWorker(() => stopWorker(crashFailure(
    "worker-protocol",
    "YARA-X worker sent a message that could not be deserialized"
  ))));
  initializationTimer = setTimeout(() => stopWorker(createScannerFailure({
    code: SCANNER_FAILURE_CODES.INITIALIZATION_FAILED,
    stage: "initialization",
    message: "YARA-X scanner initialization timed out",
    terminal: true
  })), SCANNER_TIMEOUTS.INITIALIZE_MS);
}
function crashFailure(stage, message) {
  return createScannerFailure({
    code: SCANNER_FAILURE_CODES.WORKER_CRASHED,
    stage,
    message,
    terminal: true,
    retryable: workerHasScanned
  });
}
function stopWorker(failure) {
  clearTimeout(initializationTimer);
  worker?.terminate();
  worker = void 0;
  scannerStatus = failedStatus(failure);
  settleInitialization({ ok: false, failure });
  takeActiveScan()?.reject(failureError(failure));
}
function handleWorkerMessage(event) {
  const message = event.data;
  if (message?.type === SCANNER_WORKER_MESSAGES.INITIALIZED) {
    clearTimeout(initializationTimer);
    scannerStatus = { state: "ready", runtime: message.runtime };
    settleInitialization({ ok: true, runtime: message.runtime });
    return;
  }
  if (message?.type === SCANNER_WORKER_MESSAGES.INITIALIZATION_FAILED) {
    stopWorker(normalizedFailure(message.failure, {
      code: SCANNER_FAILURE_CODES.INITIALIZATION_FAILED,
      stage: "initialization",
      message: "YARA-X scanner initialization failed",
      terminal: true
    }));
    return;
  }
  if (message?.type !== SCANNER_WORKER_MESSAGES.SCAN_RESULT && message?.type !== SCANNER_WORKER_MESSAGES.SCAN_FAILED) {
    return;
  }
  if (message.requestId !== activeScan?.requestId) {
    return;
  }
  const failure = message.type === SCANNER_WORKER_MESSAGES.SCAN_FAILED ? normalizedFailure(message.failure, {
    code: SCANNER_FAILURE_CODES.RESULT_TRANSPORT_FAILED,
    stage: "worker-protocol",
    message: "YARA-X worker returned an invalid failure response"
  }) : void 0;
  if (failure?.terminal) {
    stopWorker(failure);
    return;
  }
  workerHasScanned = true;
  const pending = takeActiveScan();
  if (failure) {
    pending.reject(failureError(failure));
  } else {
    pending.resolve(message.result);
  }
}
async function handleRequest(message) {
  if (message.type === SCANNER_REQUESTS.INITIALIZE) {
    if (activeScan) {
      stopWorker(createScannerFailure({
        code: SCANNER_FAILURE_CODES.WORKER_UNAVAILABLE,
        stage: "host-request",
        message: "YARA-X scan was abandoned by a stopped scanner coordinator",
        terminal: true,
        retryable: true
      }));
    }
    if (!worker) {
      startWorker();
    }
    const outcome = await initialization;
    if (!outcome.ok) {
      throw failureError(outcome.failure);
    }
    return { runtime: outcome.runtime };
  }
  if (message.type === SCANNER_REQUESTS.STATUS) {
    return { scannerStatus };
  }
  if (message.type !== SCANNER_REQUESTS.SCAN) {
    throw failureError(createScannerFailure({
      code: SCANNER_FAILURE_CODES.INVALID_REQUEST,
      stage: "host-request",
      message: "Unknown scanner host request"
    }));
  }
  if (typeof message.requestId !== "string") {
    throw failureError(createScannerFailure({
      code: SCANNER_FAILURE_CODES.INVALID_REQUEST,
      stage: "host-request",
      message: "YARA-X scanner host received a scan without a payload reference"
    }));
  }
  const payload = await receivePayload(message.requestId);
  if (scannerStatus.state !== "ready") {
    throw failureError(createScannerFailure({
      code: SCANNER_FAILURE_CODES.WORKER_UNAVAILABLE,
      stage: "host-request",
      message: scannerStatus.state === "failed" ? `YARA-X worker is unavailable: ${scannerStatus.failure.message}` : "YARA-X worker is still initializing",
      terminal: true,
      retryable: true
    }));
  }
  if (activeScan) {
    throw failureError(createScannerFailure({
      code: SCANNER_FAILURE_CODES.OVERLAPPING_SCAN,
      stage: "host-request",
      message: "YARA-X scanner host received an overlapping scan"
    }));
  }
  return { result: await scan(payload, message.lengths) };
}
function scan(payload, lengths) {
  const requestId = nextWorkerRequestId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => stopWorker(createScannerFailure({
      code: SCANNER_FAILURE_CODES.SCAN_TIMEOUT,
      stage: "yara-scan",
      message: `YARA-X scan did not finish within ${SCANNER_TIMEOUTS.SCAN_MS / 1e3}s`,
      terminal: true
    })), SCANNER_TIMEOUTS.SCAN_MS);
    activeScan = { requestId, resolve, reject, timer };
    worker.postMessage({
      type: SCANNER_WORKER_MESSAGES.SCAN,
      requestId,
      payload,
      lengths
    }, [payload]);
  });
}
function receivePayload(requestId) {
  const delivered = deliveredPayload;
  deliveredPayload = void 0;
  if (delivered?.requestId === requestId) {
    return delivered.payload;
  }
  return new Promise((resolve) => {
    payloadWaiter = { requestId, resolve };
  });
}
function takeActiveScan() {
  const pending = activeScan;
  activeScan = void 0;
  clearTimeout(pending?.timer);
  return pending;
}
function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}
function failureError(failure) {
  const error = new Error(failure.message);
  error.scannerFailure = failure;
  return error;
}
function failureFromError(error) {
  return isScannerFailure(error?.scannerFailure) ? error.scannerFailure : createScannerFailure({
    code: SCANNER_FAILURE_CODES.RESULT_PROCESSING_FAILED,
    stage: "host-processing",
    message: errorDetail(error)
  });
}
function normalizedFailure(value, defaults) {
  return isScannerFailure(value) ? value : createScannerFailure(defaults);
}
function failedStatus(failure) {
  return {
    state: "failed",
    error: failure.message,
    failure
  };
}
