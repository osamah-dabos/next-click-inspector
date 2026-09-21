// Dev Inspector overlay — plain JS, no React. Injected automatically by loader.cjs.
// Lives in a Shadow DOM so your CSS can't touch it and it can't touch yours.
(function () {
  if (typeof window === "undefined" || window.__devInspectorLoaded) return;
  window.__devInspectorLoaded = true;

  var CFG = window.__DEV_INSPECTOR__ || {};
  var ENDPOINT = CFG.endpoint;
  function api(route, loc) {
    return ENDPOINT + route + "?token=" + encodeURIComponent(CFG.token) +
      "&file=" + encodeURIComponent(loc.file) + "&line=" + loc.line + "&col=" + loc.col;
  }
  var ATTR = "data-insp";
  // The component trail stops at the first Next.js/React internal it reaches
  var INTERNAL =
    /^(ClientPageRoot|ClientSegmentRoot|LayoutRouter\w*|InnerLayoutRouter|OuterLayoutRouter|RenderFromTemplateContext|\w*Scroll\w*Handler\w*|\w*Boundary\w*|ErrorBoundaryHandler|GlobalError|Router|AppRouter|ServerRoot|Root|HotReload|ReactDevOverlay|AppDevOverlay\w*|SegmentViewNode|SegmentStateProvider|Container|AppContainer|PathnameContextProviderAdapter)$/;

  var CSS =
    ":host{all:initial}" +
    "*{box-sizing:border-box}" +
    ".box{position:fixed;pointer-events:none;z-index:2147483646;background:rgba(76,141,255,.12);outline:1.5px solid #4c8dff;border-radius:2px;display:none}" +
    ".box.picked{outline-style:dashed}" +
    ".label{position:absolute;left:0;display:flex;gap:8px;white-space:nowrap;padding:3px 8px;border-radius:4px;background:#4c8dff;color:#fff;font:12px/1.5 ui-sans-serif,system-ui,sans-serif}" +
    ".label b{font-weight:600}.label span{opacity:.75}" +
    ".fab{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:40px;height:40px;display:grid;place-items:center;border:1px solid #343a46;border-radius:999px;background:#1f232b;color:#c9cfdb;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}" +
    ".fab[aria-pressed=true]{background:#4c8dff;color:#fff;border-color:#4c8dff}" +
    ".fab:focus-visible,button:focus-visible{outline:2px solid #a9c6ff;outline-offset:2px}" +
    ".hint{position:fixed;right:64px;bottom:22px;z-index:2147483647;padding:6px 10px;border-radius:6px;background:#1f232b;color:#dfe3ec;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;display:none;pointer-events:none}" +
    ".panel{position:fixed;right:16px;bottom:68px;z-index:2147483647;width:min(620px,calc(100vw - 32px));max-height:min(calc(100vh - 100px),560px);display:none;flex-direction:column;background:#1f232b;color:#dfe3ec;border:1px solid #343a46;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.45);font:13px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden;direction:ltr;text-align:left}" +
    ".head{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #343a46}" +
    ".title{font-size:15px;font-weight:600;color:#fff}.title span{color:#8b93a7;font-weight:400}" +
    ".trail{color:#8b93a7;font-size:12px;margin-top:2px}" +
    ".path{font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#a9c6ff;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".x{background:none;border:0;color:#8b93a7;font-size:22px;line-height:1;cursor:pointer;align-self:flex-start}" +
    ".code{overflow:auto;flex:1;padding:6px 0;background:#171a20;font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}" +
    ".row{display:flex;padding-right:14px}.row.hit{background:rgba(76,141,255,.18)}" +
    ".num{width:48px;flex-shrink:0;text-align:right;padding-right:14px;user-select:none;color:#5c6375}.hit .num{color:#4c8dff}" +
    ".txt{white-space:pre}.msg{padding:12px;color:#8b93a7}" +
    ".foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid #343a46}" +
    ".btn{font:12.5px ui-sans-serif,system-ui,sans-serif;padding:6px 10px;border-radius:6px;border:1px solid #3d4452;background:#272c36;color:#dfe3ec;cursor:pointer}" +
    ".btn.primary{background:#4c8dff;border-color:#4c8dff;color:#fff}" +
    ".status{color:#8b93a7;font-size:12px}";

  var HTML =
    '<style>' + CSS + '</style>' +
    '<div class="box"><div class="label"><b></b><span></span></div></div>' +
    '<button class="fab" type="button" aria-pressed="false" aria-label="Inspect elements" title="Inspect elements (Alt+Shift+C)">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>' +
    '<div class="hint">Click an element to see its code. Shift+click opens it in your editor. Esc to cancel.</div>' +
    '<section class="panel" aria-label="Element source">' +
    '<header class="head"><div style="min-width:0"><div class="title"></div><div class="trail"></div><div class="path"></div></div>' +
    '<button class="x" type="button" aria-label="Close">×</button></header>' +
    '<div class="code"></div>' +
    '<footer class="foot">' +
    '<button class="btn primary" data-act="open" type="button">Open in editor</button>' +
    '<button class="btn" data-act="parent" type="button">Select parent</button>' +
    '<button class="btn" data-act="again" type="button">Pick another</button>' +
    '<button class="btn" data-act="copy" type="button">Copy path</button>' +
    '<span class="status"></span></footer></section>';

  // ---------- helpers ----------
  function parseLoc(raw) {
    var m = raw && raw.match(/^(.*):(\d+):(\d+)$/);
    return m ? { file: m[1], line: +m[2], col: +m[3], raw: raw } : null;
  }

  function componentTrail(el) {
    var key = Object.keys(el).find(function (k) { return k.indexOf("__reactFiber$") === 0; });
    var fiber = key ? el[key] : null;
    var names = [];
    while (fiber && names.length < 5) {
      var t = fiber.type, name;
      if (typeof t === "function") name = t.displayName || t.name;
      else if (t && typeof t === "object") {
        var inner = t.render || t.type;
        name = t.displayName || (inner && (inner.displayName || inner.name));
      }
      if (name && INTERNAL.test(name)) break;
      if (name && names[names.length - 1] !== name) names.push(name);
      fiber = fiber["return"];
    }
    return names;
  }

  function pick(el) {
    var loc = parseLoc(el.getAttribute(ATTR));
    return loc ? { el: el, loc: loc, components: componentTrail(el) } : null;
  }

  function openInEditor(loc) {
    return fetch(api("/open", loc), { method: "POST" }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || "Editor didn't open"); });
    });
  }

  // ---------- mount ----------
  function mount() {
    var host = document.createElement("dev-inspector");
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML = HTML;
    document.documentElement.appendChild(host); // outside <body>, so React never sees it

    var $ = function (s) { return root.querySelector(s); };
    var box = $(".box"), labelName = $(".label b"), labelPath = $(".label span");
    var fab = $(".fab"), hint = $(".hint"), panel = $(".panel");
    var titleEl = $(".title"), trailEl = $(".trail"), pathEl = $(".path"), codeEl = $(".code"), statusEl = $(".status");
    var cursorStyle = document.createElement("style");
    cursorStyle.textContent = "*{cursor:crosshair!important}";

    var active = false, hovered = null, picked = null, fetchCtrl = null;

    function isOwn(t) { return t === host || (t instanceof Node && host.contains(t)); }
    function locate(t) {
      if (!(t instanceof Element) || isOwn(t)) return null;
      return t.closest("[" + ATTR + "]");
    }

    function drawBox() {
      var el = active ? hovered : picked && picked.el.isConnected ? picked.el : null;
      if (!el) { box.style.display = "none"; return; }
      var r = el.getBoundingClientRect();
      box.style.display = "block";
      box.style.top = r.top + "px";
      box.style.left = r.left + "px";
      box.style.width = r.width + "px";
      box.style.height = r.height + "px";
      box.classList.toggle("picked", !active);
      var label = box.firstElementChild;
      var info = active && pick(el);
      label.style.display = info ? "flex" : "none";
      if (info) {
        labelName.textContent = info.components[0] || "<" + el.tagName.toLowerCase() + ">";
        labelPath.textContent = info.loc.file + ":" + info.loc.line;
        label.style.bottom = r.top > 30 ? "100%" : "";
        label.style.top = r.top > 30 ? "" : "100%";
        label.style.margin = r.top > 30 ? "0 0 4px" : "4px 0 0";
      }
    }

    function setActive(v) {
      active = v;
      fab.setAttribute("aria-pressed", String(v));
      hint.style.display = v && !picked ? "block" : "none";
      if (v) document.head.appendChild(cursorStyle);
      else { cursorStyle.remove(); hovered = null; }
      drawBox();
    }

    function setStatus(s) { statusEl.textContent = s || ""; }

    function select(p) {
      picked = p;
      panel.style.display = "flex";
      hint.style.display = "none";
      titleEl.textContent = p.components[0] || "Server component";
      var tag = document.createElement("span");
      tag.textContent = " <" + p.el.tagName.toLowerCase() + ">";
      titleEl.appendChild(tag);
      trailEl.textContent = p.components.length > 1 ? "inside " + p.components.slice(1).join(" in ") : "";
      pathEl.textContent = p.loc.file + ":" + p.loc.line + ":" + p.loc.col;
      codeEl.innerHTML = '<div class="msg">Loading…</div>';
      setStatus("");
      drawBox();

      if (fetchCtrl) fetchCtrl.abort();
      fetchCtrl = new AbortController();
      fetch(api("/snippet", p.loc), { signal: fetchCtrl.signal })
        .then(function (r) { if (!r.ok) throw new Error("Couldn't read " + p.loc.file + " (" + r.status + ")"); return r.json(); })
        .then(function (s) {
          pathEl.title = s.absPath;
          codeEl.textContent = "";
          var hitRow = null;
          s.lines.forEach(function (text, i) {
            var n = s.start + i;
            var row = document.createElement("div");
            row.className = "row" + (n === p.loc.line ? " hit" : "");
            var num = document.createElement("span"); num.className = "num"; num.textContent = n;
            var txt = document.createElement("span"); txt.className = "txt"; txt.textContent = text || " ";
            row.append(num, txt);
            codeEl.appendChild(row);
            if (n === p.loc.line) hitRow = row;
          });
          if (hitRow) codeEl.scrollTop = hitRow.offsetTop - codeEl.clientHeight / 2;
        })
        .catch(function (e) {
          if (e.name === "AbortError") return;
          if (e instanceof TypeError) e = new Error("Can't reach the inspector helper at " + ENDPOINT + ". Restart next dev.");
          codeEl.innerHTML = '<div class="msg"></div>', codeEl.firstChild.textContent = e.message; });
    }

    function close() {
      picked = null;
      panel.style.display = "none";
      drawBox();
    }

    // ---------- events ----------
    fab.addEventListener("click", function () { setActive(!active); });
    $(".x").addEventListener("click", close);
    $(".foot").addEventListener("click", function (e) {
      var act = e.target.closest && e.target.closest("[data-act]");
      if (!act || !picked) return;
      var a = act.getAttribute("data-act");
      if (a === "open") openInEditor(picked.loc).then(function () { setStatus("Opened in editor"); }, function (err) { setStatus(err.message); });
      if (a === "again") setActive(true);
      if (a === "copy") navigator.clipboard.writeText(picked.loc.file + ":" + picked.loc.line + ":" + picked.loc.col).then(function () { setStatus("Path copied"); });
      if (a === "parent") {
        var el = picked.el.parentElement && picked.el.parentElement.closest("[" + ATTR + "]");
        while (el && el.getAttribute(ATTR) === picked.loc.raw) el = el.parentElement && el.parentElement.closest("[" + ATTR + "]");
        if (el) select(pick(el)); else setStatus("No parent element with source info");
      }
    });

    window.addEventListener("keydown", function (e) {
      if (e.altKey && e.shiftKey && e.code === "KeyC") { e.preventDefault(); setActive(!active); }
      else if (e.key === "Escape") { if (active) setActive(false); else if (picked) close(); }
    });

    document.addEventListener("pointermove", function (e) {
      if (!active) return;
      var el = locate(e.target);
      if (el !== hovered) { hovered = el; drawBox(); }
    }, true);

    function block(e) {
      if (!active || isOwn(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }
    ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick", "contextmenu"].forEach(function (t) {
      document.addEventListener(t, block, true);
    });

    document.addEventListener("click", function (e) {
      if (!active || isOwn(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      var el = locate(e.target);
      var p = el && pick(el);
      if (!p) return;
      setActive(false);
      select(p);
      if (e.shiftKey) openInEditor(p.loc).then(function () { setStatus("Opened in editor"); }, function (err) { setStatus(err.message); });
    }, true);

    var raf = 0;
    function bump() { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawBox); }
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
