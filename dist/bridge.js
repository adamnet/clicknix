(() => {
  // src/activation.js
  function whenActivated(start) {
    if (!document.prerendering) {
      start();
      return;
    }
    const activated = () => {
      if (document.prerendering) return;
      observer.disconnect();
      document.removeEventListener("prerenderingchange", activated);
      chrome.runtime.onMessage.removeListener(handleMessage);
      start();
    };
    const handleMessage = (message) => {
      if (message?.type === "start-document") activated();
      return false;
    };
    const listen = () => document.addEventListener("prerenderingchange", activated);
    const observer = new MutationObserver(listen);
    observer.observe(document, { childList: true });
    listen();
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  // src/clipboard-command.js
  var LAUNCHER_LEAD = /\s*["'`]?\s*/y;
  var START = /start\s+/iy;
  var CMD_SCRIPT = /(?:cmd(?:\.exe)?|%comspec%)\s+\/[ck]\s+/iy;
  var SUDO = /sudo\s+/iy;
  var LAUNCHER = /["']?(?:(?:[a-z]:|%\w+%)?[\\/][\w\\/.%() -]*[\\/])?(?:(?:powershell|pwsh|mshta|conhost|msiexec|rundll32|regsvr32|wscript|cscript|bitsadmin|certutil|forfiles|finger|cmd|curl|wget|bash|zsh|sh|osascript|echo|iwr|irm|iex|invoke-webrequest|invoke-restmethod|invoke-expression)(?:\.exe)?\b|%comspec%)/iy;
  var DASH_OPTION = /-\S+\s+/y;
  var SLASH_OPTION = /\/\w+(\s+)/y;
  var BLANKS = /\s+/y;
  var LEADING_BLANKS = /\s*/y;
  var DISGUISE = /(?:(?:^|[\s;])<?#|(?:^|[&|(]\s*)(?:rem\b|::))[^\n]{0,200}?(?:robot|captcha|veri?f|human|ray\s*id|cloudflare|security\s+check|\u2705|\u2714)/i;
  var PADDING = /\S[\p{Zs}\t\u2800]{40}[\p{Zs}\t]*\S/u;
  var ESCAPE = /\^([^])|`([^`])/g;
  var WINDOW_OPTION = String.raw`(?:^|\s)[-/\u2013\u2014\u2015]w(?:i(?:n(?:d(?:o(?:w(?:s(?:t(?:y(?:l(?:e)?)?)?)?)?)?)?)?)?)?\s+["']?`;
  var NAMED_HIDDEN_WINDOW = new RegExp(
    String.raw`${WINDOW_OPTION}(?:h(?:i(?:d(?:d(?:e(?:n)?)?)?)?)?|mi(?:n(?:i(?:m(?:i(?:z(?:e(?:d)?)?)?)?)?)?)?)(?![\w.])|--headless\b`,
    "i"
  );
  var NUMERIC_HIDDEN_WINDOWS = new RegExp(String.raw`${WINDOW_OPTION}[12](?![\w.])`, "gi");
  var COMMAND_BREAKS = /[|&;\n]|(?<=\s\/[ck])\s+["']?|(?<=\s-c)\s+["']/gi;
  var WAIT_PREFIX = /(start)(?=((?:\s+"[^"\n]*")?))\2|sudo|(?:cmd(?:\.exe)?|%comspec%)\s+\/[ck]/iy;
  var WAIT_OPTION_TOOL = /["']?(?:[\w:.%\\/-]*[\\/])?(?:ping|nc|ncat|netcat|curl|wget|timeout|grep)(?:\.exe)?(?=[\s"']|$)/iy;
  var START_SWITCH = /\/\w+/y;
  var POWERSHELL = /\b(?:powershell|pwsh)\b/i;
  var ENCODED = /(?:^|\s)[-/\u2013\u2014\u2015]e(?:c|n(?:c(?:o(?:d(?:e(?:d(?:c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?)?)?)?)?)?)?)?\s+["']?[a-z0-9+/=]{20,}|frombase64string|\bbase64\s+(?:-d|--decode|-D)\b/i;
  var REMOTE_SCRIPT_LOADER = /\bmshta(?:\.exe)?["']?\s+["']?(?:https?:|\\\\)|\brundll32(?:\.exe)?["']?\s+["']?\\\\|\/i:["']?(?:https?:|\\\\)|\bscrobj\b/i;
  var DOWNLOAD = /\b(?:iwr|irm|invoke-webrequest|invoke-restmethod|downloadstring|downloadfile|webclient|start-bitstransfer|bitsadmin|curl|wget|finger)\b|-urlcache\b/i;
  var PIPED_PATH = String.raw`(?:[a-z]:|%\w+%)?[\\/][\w\\/.%()-]*[\\/]`;
  var PIPED_INTERPRETER = String.raw`(?:(?:ba|z)?sh|powershell|pwsh|cmd|python[\d.]*|perl|ruby|node|osascript)`;
  var PIPE = /\|\s*/g;
  var PIPED_WRAPPER = new RegExp(String.raw`(?:${PIPED_PATH})?(?:sudo|nohup|env|exec|command)\s+`, "iy");
  var PIPED_PROGRAM = new RegExp(
    String.raw`${PIPED_INTERPRETER}\b|${PIPED_PATH}${PIPED_INTERPRETER}(?:\.exe)?(?![\w\\/.-])`,
    "iy"
  );
  var EXECUTE = new RegExp(
    String.raw`\b(?:iex|invoke-expression|start-process)\b|\[scriptblock\]::create\b|` + String.raw`&\s*\(|(?:^|[|;(])\s*\.\s*\(|[$<]\(\s*(?:curl|wget)\b|\bchmod\s+\+x\b|` + String.raw`(?:&&?|;)\s*(?:(?:start|call)\b|(?:sudo\s+)?(?:(?:ba|z)?sh|source|\.)\s+\S|[.~]?\/\S|["']?[^\s&|;"']*\.(?:exe|bat|cmd|com|ps1|vbs|js|hta|msi|scr)\b)`,
    "i"
  );
  var MSIEXEC = /\bmsiexec(?:\.exe)?["']?\s+/gi;
  var REMOTE_INSTALL_OPTION = /\/(?:i|package)\s*["']?(?:https?:|\\\\)/iy;
  var SCRIPT_HOST = /\b(?:powershell|pwsh|mshta|wscript|cscript|rundll32|regsvr32|conhost)\b/i;
  var CLIPBOARD_NOTICE_MESSAGE = "clipboard-notice";
  var CLIPBOARD_COMMAND = Object.freeze({
    SCAM: "scam",
    DOWNLOAD_EXECUTE: "download-execute"
  });
  function classifyClipboardCommand(text) {
    if (typeof text !== "string") return null;
    const command = text.replace(ESCAPE, "$1$2");
    if (!startsLikeCommand(command)) return null;
    if (hidesWindow(command) || ENCODED.test(command) || REMOTE_SCRIPT_LOADER.test(command)) {
      return CLIPBOARD_COMMAND.SCAM;
    }
    const remoteInstall = installsRemotely(command);
    const runsCode = remoteInstall || EXECUTE.test(command) || pipesIntoInterpreter(command);
    if ((DISGUISE.test(command) || PADDING.test(text)) && (runsCode || SCRIPT_HOST.test(command))) {
      return CLIPBOARD_COMMAND.SCAM;
    }
    if (remoteInstall || runsCode && DOWNLOAD.test(command)) {
      return CLIPBOARD_COMMAND.DOWNLOAD_EXECUTE;
    }
    return null;
  }
  function hidesWindow(command) {
    if (NAMED_HIDDEN_WINDOW.test(command)) return true;
    const powershell = POWERSHELL.test(command.replace(/"/g, ""));
    COMMAND_BREAKS.lastIndex = 0;
    let nextBreak = COMMAND_BREAKS.exec(command);
    let start = 0;
    let owned = null;
    for (const { index } of command.matchAll(NUMERIC_HIDDEN_WINDOWS)) {
      if (powershell) return true;
      while (nextBreak && nextBreak.index <= index) {
        start = COMMAND_BREAKS.lastIndex;
        owned = null;
        nextBreak = COMMAND_BREAKS.exec(command);
      }
      if (owned === null) owned = startsWaitOptionTool(command, start);
      if (!owned) return true;
    }
    return false;
  }
  function matchesAt(pattern, text, index) {
    pattern.lastIndex = index;
    return pattern.test(text);
  }
  function startsLikeCommand(command) {
    matchesAt(LAUNCHER_LEAD, command, 0);
    let index = LAUNCHER_LEAD.lastIndex;
    if (!matchesAt(START, command, index)) return launchesFrom(command, index);
    index = START.lastIndex;
    for (let pathStart = true; ; ) {
      SLASH_OPTION.lastIndex = index;
      const option = SLASH_OPTION.exec(command);
      if (!option) return launchesFrom(command, index);
      if (pathStart && matchesAt(LAUNCHER, command, index)) return true;
      pathStart = /[^ ]/.test(option[1]);
      index = SLASH_OPTION.lastIndex;
    }
  }
  function launchesFrom(command, index) {
    const scripted = matchesAt(CMD_SCRIPT, command, index) && launchesBehindSudo(command, CMD_SCRIPT.lastIndex);
    return scripted || launchesBehindSudo(command, index);
  }
  function launchesBehindSudo(command, index) {
    if (matchesAt(SUDO, command, index)) index = skipOptions(command, SUDO.lastIndex);
    return matchesAt(LAUNCHER, command, index);
  }
  function skipOptions(command, index) {
    while (matchesAt(DASH_OPTION, command, index)) index = DASH_OPTION.lastIndex;
    return index;
  }
  function pipesIntoInterpreter(command) {
    for (const pipe of command.matchAll(PIPE)) {
      let index = pipe.index + pipe[0].length;
      for (let wrappers = 3; ; wrappers--) {
        if (matchesAt(PIPED_PROGRAM, command, index)) return true;
        if (wrappers === 0 || !matchesAt(PIPED_WRAPPER, command, index)) break;
        index = skipOptions(command, PIPED_WRAPPER.lastIndex);
      }
    }
    return false;
  }
  function installsRemotely(command) {
    for (const msiexec of command.matchAll(MSIEXEC)) {
      let index = msiexec.index + msiexec[0].length;
      for (; ; ) {
        if (matchesAt(REMOTE_INSTALL_OPTION, command, index)) return true;
        if (!matchesAt(SLASH_OPTION, command, index)) break;
        index = SLASH_OPTION.lastIndex;
      }
    }
    return false;
  }
  function startsWaitOptionTool(command, start) {
    matchesAt(LEADING_BLANKS, command, start);
    let index = LEADING_BLANKS.lastIndex;
    for (; ; ) {
      if (matchesAt(WAIT_OPTION_TOOL, command, index)) return true;
      WAIT_PREFIX.lastIndex = index;
      const prefix = WAIT_PREFIX.exec(command);
      if (!prefix) return false;
      index = WAIT_PREFIX.lastIndex;
      for (; ; ) {
        if (!matchesAt(BLANKS, command, index)) return false;
        index = BLANKS.lastIndex;
        if (!prefix[1] || !matchesAt(START_SWITCH, command, index)) break;
        if (matchesAt(WAIT_OPTION_TOOL, command, index)) return true;
        index = START_SWITCH.lastIndex;
      }
    }
  }

  // icons/logo-notice.png
  var logo_notice_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAsCAMAAACwjrHDAAAAflBMVEX+OQACAgIAAAD+JgD49/YAAAAAAADu7e3/OQD+OAD9XwOgoaH5+Pj9/f3xraZRUlL4TRv1c2pfFQKzIQH3n3+ZdWz7kHHspJDky7f8SBL9dVB/AAB2RDtwfYHxa0MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAByJEKBAAAAIHRSTlP69l0S/C6dGJ5gBf9wpAj++gf//gj///8TWf4C//9MAEKSDCIAAAPASURBVHjazZnZltsgDIaNCNjgyTqdtQvv/5ZlkUBA4ml7YaozZw4BJ3yRfoklkytmrXNSmmWKthgj/WvrRtiUWwFAIhLZYgLoSKw7UNFMHBqFJe9DBY/JAVxTppoemnFWDsGSzkwbtuzONXVUi5FS2pKRQ7imhsqw6Suu3bFs0VWAssFV0Rp97YvlKWhuyaqUTc7K+blvPk40f5r5OqPZFFhTQin3lNdkc7DqWWWSVJGY6eQF3tSXM6h/GPFYNK10pznbaf4Ifb/m9/fvGbtahkCLaBrCBEKkTqHbCaou/5xiI/FNWqi72qJcmw/cLr7vMzSenL3jLoSKYHGG+Nn+FXRYonohmhEQ/VcJWOisq6yw3kJfbD1JeoRhaQKA2CAsLbqv3mHpDgvuYMm8IldYoe81YblZUphlocqfrrXKWK7XWoeVKXAEwD3GknOF9eq7LocGK0dRtY4HIR7pt8eiR6uRFsugsk4e65z1EvpuseWxvmEUc6nX7Qd23lKgdWrT5Mo7NT6X5cW9lV2mIGbotGB5v3osIRDsOfSJgmVqcXUqJSxi0DkZ8uQlNejdOBKjmkMblQqQa1bCOkSP3YqzAta7q8XVh4xJHhNSaJ2TFKOnUN9QsiUJAuIboeSMUhnrhFgBbCrOClinHsttYWk+L/0T5TnMV46FfTktGywhViwOomDNf4mVY6zSTCVx8TlBHixYsa+kUoclxEuopM/bWFtBrKmDqPJs+Jxi4SUsl6ZzD7GCsi4v4nEQVVcBt7HKbCw1oMVSrHa4RvJUHF5/bmA9zsSIpe9giaaQBCk1WI6vAE2B8CXiwpVVFwjC0q27tr0F0GgLGWosLRhXLqdYt9IafWuwcFG0pXAxdakGq44xoAOhxlLkQ1VKA5T1sVp8QoH4TM5aV7Gez2uSPG1tqsgAcxT7bO5MUOQ77GLJAjUWUPlS/VLtaX4Evd9iXT2sq69hHiufQNo1FwBQp7jxKuVUQ9yQsVouVJ3DmmNRaaAwVBsbXHawOJzjH9vYTL2SKXswjRBL0RBkLEWMJfiirvLVupa3gcY9HQ7rS3DW28rMe+tj6rFoe6oxlkqHlqKXYTC1qQtSMecpnEZiF2jSXOpkm+b5eDwGvV+Olc3lYDbqiGH6owY/xY45kNkrbr3YUePE7wEGHV+X5oATWvx6adRhH2+NotkAVV96jbsaqZTV3sQNv0jyZkx3PfifXbsZMwbrq0vKUVhfXOkOw9q6ACdXLvtdcf3RzwV0BScHYN35ccU6/K3Ap8SyyB3vT38DaCMZKIUjEFQAAAAASUVORK5CYII=";

  // src/clipboard-notice.js
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  var MESSAGES = {
    [CLIPBOARD_COMMAND.SCAM]: {
      color: "#b42318",
      headline: "Stop - don't paste this.",
      text: `This website secretly copied a command to your clipboard. If it asked you to press Windows\xA0+\xA0R, open Terminal, or paste something to "verify you're human", it's a scam that installs malware. Real websites never ask you to do that.`
    },
    [CLIPBOARD_COMMAND.DOWNLOAD_EXECUTE]: {
      color: "#92400e",
      headline: "Heads up:",
      text: "this website copied a command that downloads and runs software on your computer. Only paste it if you trust this site and meant to install something."
    }
  };
  var STYLE = `
  :host {
    all: initial !important; display: block !important; position: fixed !important;
    inset: 0 0 auto 0 !important; z-index: 2147483647 !important;
  }
  :host::before, :host::after { content: none !important; }
  div {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px;
    position: fixed; inset: 0 0 auto 0; width: auto; height: auto; margin: 0; border: 0;
    overflow: visible; font: 14px/1.4 system-ui, sans-serif; color: #fff;
    background: var(--color); box-shadow: 0 2px 12px #0004;
  }
  img {
    display: block; height: 22px; width: auto; padding: 3px 6px;
    background: #fff; border-radius: 6px;
  }
  p { flex: 1 1 320px; margin: 0; }
  button {
    font: inherit; padding: 4px 12px; border: 1px solid #fff; border-radius: 6px;
    color: inherit; background: transparent; cursor: pointer; white-space: nowrap;
  }
  button:hover { background: #fff3; }
  button.primary { color: var(--color); background: #fff; font-weight: 600; }
  button.primary:hover { background: #fffd; }
`;
  var notices = /* @__PURE__ */ new WeakMap();
  function showClipboardNotice(kind, view = window) {
    const message = MESSAGES[kind];
    if (!message) return;
    const notice = notices.get(view.document);
    if (notice && (notice.kind === CLIPBOARD_COMMAND.SCAM || notice.kind === kind)) {
      notice.attach();
      return;
    }
    notice?.dismiss();
    notices.set(view.document, createNotice(kind, message, view));
  }
  function createNotice(kind, message, view) {
    const { document: document2 } = view;
    const create = (name) => document2.createElementNS(HTML_NAMESPACE, name);
    const host = create("div");
    const root = host.attachShadow({ mode: "closed" });
    const style = create("style");
    style.textContent = STYLE;
    const bar = create("div");
    bar.setAttribute("role", "alert");
    bar.popover = "manual";
    bar.style.setProperty("--color", message.color);
    const brand = create("img");
    brand.src = logo_notice_default;
    brand.alt = "ClickNix";
    const text = create("p");
    const headline = create("strong");
    headline.textContent = message.headline;
    text.append(headline, ` ${message.text}`);
    const clear = create("button");
    clear.className = "primary";
    clear.textContent = "Clear clipboard";
    const dismiss = create("button");
    dismiss.textContent = "Dismiss";
    bar.append(brand, text, clear, dismiss);
    root.append(style, bar);
    const show = (raise) => {
      if (!host.isConnected) return;
      for (const name of host.getAttributeNames()) {
        if (name !== "popover") host.removeAttribute(name);
      }
      if (host.getAttribute("popover") !== "manual") host.setAttribute("popover", "manual");
      if (!host.matches(":popover-open")) host.showPopover();
      if (!host.isConnected) return;
      if (raise && bar.matches(":popover-open")) bar.hidePopover();
      if (!bar.matches(":popover-open")) bar.showPopover();
    };
    const attach = () => {
      const rootElement = document2.documentElement;
      if (!rootElement) return;
      observer.observe(rootElement, { childList: true });
      if (host.parentNode !== rootElement) rootElement.append(host);
      show(false);
    };
    const observer = new MutationObserver(() => attach());
    const occlusion = new view.IntersectionObserver((entries) => {
      if (!entries.at(-1).isVisible) show(true);
    }, { trackVisibility: true, delay: 100 });
    const state = {
      kind,
      attach,
      dismiss() {
        observer.disconnect();
        occlusion.disconnect();
        host.remove();
        if (notices.get(document2) === state) notices.delete(document2);
      }
    };
    clear.addEventListener("click", async () => {
      try {
        await view.navigator.clipboard.writeText("");
        text.textContent = "Done - your clipboard is empty.";
        clear.remove();
      } catch {
        text.textContent = "Couldn't clear your clipboard. Copy some other text before you paste anything.";
      }
    });
    dismiss.addEventListener("click", () => state.dismiss());
    observer.observe(document2, { childList: true });
    observer.observe(host, { attributes: true });
    occlusion.observe(bar);
    attach();
    return state;
  }

  // src/config.js
  var MAX_RULE_SOURCE_BYTES = 4 * 1024 * 1024;
  var MAX_RULE_BUNDLE_BYTES = 8 * MAX_RULE_SOURCE_BYTES;
  var MAX_SCAN_BYTES = 2 * 1024 * 1024;
  var MAX_CAPTURE_CHARS = 15e5;
  var SCAN_WINDOW_OVERLAP_CHARS = 64 * 1024;
  var shadowRootEventType = (handshakeId) => `clicknix-attach-shadow-${handshakeId}`;
  var SHADOW_ROOT_EVENT_GLOBAL = "clickNixShadowRootEvent";
  var BLOB_SCRIPT_GLOBAL = "clickNixBlobScript";
  var popupClipboardEventType = (handshakeId) => `clicknix-popup-clipboard-${handshakeId}`;
  var PAGE_HOOK_READY = "clicknix-page-hook-ready";
  var PAGE_HOOK_RESPONSE = "clicknix-response-body";
  var PAGE_HOOK_CLIPBOARD = "clicknix-clipboard-text";
  var PAGE_HOOK_SCRIPT_URL = "clicknix-script-url";
  var PAGE_HOOK_ACK = "clicknix-page-hook-ack";
  var PAGE_HOOK_STOP = "clicknix-page-hook-stop";
  var PAGE_HOOK_BLOB_SCRIPT = "clicknix-blob-script";

  // src/runtime-message.js
  var pending = /* @__PURE__ */ new Set();
  var pictureInPicture = matchMedia("(display-mode: picture-in-picture)");
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "rescan-document") {
      for (const resolve of pending) resolve(null);
      pending.clear();
    }
    return false;
  });
  function createMessageSender(onInvalidated) {
    return async (message) => {
      try {
        return await new Promise((resolve, reject) => {
          const sent = chrome.runtime.sendMessage({ ...message, pictureInPicture: pictureInPicture.matches });
          pending.add(resolve);
          sent.then(resolve, reject).finally(() => pending.delete(resolve));
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Extension context invalidated")) {
          onInvalidated();
        }
        return null;
      }
    };
  }

  // src/scan-window.js
  var call = Function.prototype.call;
  var charCodeAt = call.bind(String.prototype.charCodeAt);
  var slice = call.bind(String.prototype.slice);
  var exec = call.bind(RegExp.prototype.exec);
  var NON_ASCII = /[^\0-\x7f]/g;
  var ASCII_RUN_SEARCH = 16;
  function fitWindow(text, maxChars, maxBytes, start = 0) {
    const segment = slice(text, start, text.length - start < maxChars ? text.length : start + maxChars);
    let index = 0;
    let bytes = 0;
    let ascii = 0;
    while (index < segment.length) {
      const code = charCodeAt(segment, index);
      let units = 1;
      let size = 3;
      if (code < 128) {
        if (++ascii === ASCII_RUN_SEARCH) {
          NON_ASCII.lastIndex = index;
          const run = (exec(NON_ASCII, segment)?.index ?? segment.length) - index;
          if (bytes + run > maxBytes) {
            index += maxBytes - bytes;
            bytes = maxBytes;
            break;
          }
          index += run;
          bytes += run;
          continue;
        }
        size = 1;
      } else {
        ascii = 0;
        if (code < 2048) {
          size = 2;
        } else if (code >= 55296 && code <= 56319) {
          const next = charCodeAt(text, start + index + 1);
          if (next >= 56320 && next <= 57343) {
            units = 2;
            size = 4;
          }
        }
      }
      if (index + units > segment.length || bytes + size > maxBytes) break;
      index += units;
      bytes += size;
    }
    return { chars: index, bytes };
  }
  function utf8Length(text) {
    return fitWindow(text, text.length, Infinity).bytes;
  }
  var TextWindows = class {
    #text = "";
    #start = 0;
    #bytes = 0;
    push(text) {
      this.#text = this.#text.slice(this.#start) + text;
      this.#start = 0;
      this.#bytes += utf8Length(text);
      const windows = [];
      while (this.#text.length - this.#start > MAX_CAPTURE_CHARS || this.#bytes > MAX_SCAN_BYTES) {
        const { chars, bytes } = fitWindow(this.#text, MAX_CAPTURE_CHARS, MAX_SCAN_BYTES, this.#start);
        const end = this.#start + chars;
        windows.push(this.#text.slice(this.#start, end));
        this.#start = end - SCAN_WINDOW_OVERLAP_CHARS;
        this.#bytes -= bytes - fitWindow(this.#text, SCAN_WINDOW_OVERLAP_CHARS, Infinity, this.#start).bytes;
      }
      return windows;
    }
    end() {
      const text = this.#text.slice(this.#start);
      this.#text = "";
      this.#start = 0;
      this.#bytes = 0;
      return text ? [text] : [];
    }
  };

  // src/bridge.js
  var CAPTURE_RESOURCE_TYPES = /* @__PURE__ */ new Set(["Fetch", "XHR", "Blob", "Message", "Eval", "Style", "Popup"]);
  var stopImmediatePropagation = Event.prototype.stopImmediatePropagation;
  var stopped = false;
  var port;
  var MAX_SENT_CHARS = 4 * MAX_CAPTURE_CHARS;
  var unsentCaptures = [];
  var sentChars = 0;
  var activation = new Promise((resolve) => whenActivated(resolve));
  var sendRuntimeMessage = createMessageSender(stopPageHook);
  function stopPageHook() {
    if (stopped) return;
    stopped = true;
    port?.postMessage({ type: PAGE_HOOK_STOP });
    port?.close();
  }
  if (window.top === window) {
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (message?.type === CLIPBOARD_NOTICE_MESSAGE && sender.id === chrome.runtime.id && !sender.tab) {
        showClipboardNotice(message.kind);
      }
      return false;
    });
  }
  window.addEventListener(PAGE_HOOK_READY, function connect(event) {
    stopImmediatePropagation.call(event);
    window.removeEventListener(PAGE_HOOK_READY, connect, true);
    globalThis[SHADOW_ROOT_EVENT_GLOBAL] = shadowRootEventType(event.data);
    globalThis[BLOB_SCRIPT_GLOBAL] = (url, encoding) => {
      if (!stopped) port.postMessage({ type: PAGE_HOOK_BLOB_SCRIPT, url, encoding });
    };
    listenForPopupClipboard(popupClipboardEventType(event.data));
    port = event.ports[0];
    port.addEventListener("message", handlePageHookMessage);
    port.start();
  }, true);
  function listenForPopupClipboard(type) {
    const listen = () => addEventListener(type, handlePopupClipboard, true);
    new MutationObserver(listen).observe(document, { childList: true });
    listen();
  }
  function handlePopupClipboard(event) {
    stopImmediatePropagation.call(event);
    if (stopped || typeof event.data !== "string") return;
    const kind = classifyClipboardCommand(event.data);
    if (kind && event.source) showClipboardNotice(kind, event.source);
  }
  function handlePageHookMessage(event) {
    const data = event.data;
    if (stopped || !event.isTrusted) return;
    if (data?.type === PAGE_HOOK_SCRIPT_URL) {
      if (typeof data.url === "string" && /^https?:/i.test(data.url)) {
        void activation.then(() => sendRuntimeMessage({ type: "scan-script-url", url: data.url }));
      }
      return;
    }
    if (typeof data?.text !== "string" || data.text.length === 0) return;
    if (data.type === PAGE_HOOK_CLIPBOARD) {
      const kind = classifyClipboardCommand(data.text);
      if (!kind) return;
      if (window.top === window) {
        showClipboardNotice(kind);
      } else {
        void sendRuntimeMessage({ type: CLIPBOARD_NOTICE_MESSAGE, kind });
      }
      return;
    }
    if (!Number.isSafeInteger(data.messageId)) return;
    if (data.type === PAGE_HOOK_RESPONSE && typeof data.url === "string" && CAPTURE_RESOURCE_TYPES.has(data.resourceType)) {
      unsentCaptures.push({
        messageId: data.messageId,
        message: {
          type: data.resourceType === "Popup" ? "scan-popup-document" : "scan-response-body",
          url: data.url,
          resourceType: data.resourceType
        },
        text: data.text
      });
      void activation.then(sendCaptures);
    }
  }
  function sendCaptures() {
    while (unsentCaptures.length > 0 && (sentChars === 0 || sentChars + unsentCaptures[0].text.length <= MAX_SENT_CHARS)) {
      const capture = unsentCaptures.shift();
      sentChars += capture.text.length;
      void forwardCapture(capture).then(() => {
        sentChars -= capture.text.length;
        sendCaptures();
      });
    }
  }
  async function forwardCapture({ messageId, message, text }) {
    const windows = new TextWindows();
    for (const payload of [...windows.push(text), ...windows.end()]) {
      await sendRuntimeMessage({ ...message, payload });
    }
    if (!stopped) {
      port.postMessage({ type: PAGE_HOOK_ACK, messageId });
    }
  }
})();
