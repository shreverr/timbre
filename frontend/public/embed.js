/*
 * Timbre voice widget loader.
 *
 * Drop this on your site:
 *
 *   <script src="https://app.timbre.app/embed.js" data-key="pk_..." async></script>
 *
 * It injects an iframe pointing at the hosted widget and listens for resize
 * + position messages so the bubble lives in the right corner.
 */
(function () {
  "use strict";

  var current = document.currentScript;
  if (!current) {
    var scripts = document.getElementsByTagName("script");
    current = scripts[scripts.length - 1];
  }
  if (!current) return;

  var publicKey = current.getAttribute("data-key");
  if (!publicKey) {
    console.warn("[timbre] missing data-key on <script>");
    return;
  }

  var src = current.getAttribute("src") || "";
  var origin = "";
  try {
    origin = new URL(src, window.location.href).origin;
  } catch (_) {
    return;
  }

  var POSITION_STYLES = {
    "bottom-right": { bottom: "0", right: "0", top: "auto", left: "auto" },
    "bottom-left": { bottom: "0", left: "0", top: "auto", right: "auto" },
    "top-right": { top: "0", right: "0", bottom: "auto", left: "auto" },
    "top-left": { top: "0", left: "0", bottom: "auto", right: "auto" },
  };

  function applyPosition(iframe, position) {
    var style = POSITION_STYLES[position] || POSITION_STYLES["bottom-right"];
    iframe.style.position = "fixed";
    iframe.style.top = style.top;
    iframe.style.right = style.right;
    iframe.style.bottom = style.bottom;
    iframe.style.left = style.left;
    iframe.style.zIndex = "2147483646";
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.colorScheme = "normal";
  }

  function applySize(iframe, w, h) {
    iframe.style.width = w + "px";
    iframe.style.height = h + "px";
  }

  function ensureIframe() {
    if (document.getElementById("timbre-embed-iframe")) return null;
    var iframe = document.createElement("iframe");
    iframe.id = "timbre-embed-iframe";
    iframe.allow = "microphone; autoplay";
    iframe.title = "Voice widget";
    iframe.src =
      origin +
      "/embed/" +
      encodeURIComponent(publicKey) +
      "?parent=" +
      encodeURIComponent(window.location.origin);
    applyPosition(iframe, "bottom-right");
    applySize(iframe, 88, 88);
    return iframe;
  }

  function inject() {
    var iframe = ensureIframe();
    if (!iframe) return;
    document.body.appendChild(iframe);

    window.addEventListener("message", function (event) {
      if (event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (!data || data.source !== "timbre-embed") return;
      if (data.type === "resize") {
        var w = Number(data.w) || 88;
        var h = Number(data.h) || 88;
        applySize(iframe, w, h);
      } else if (data.type === "position") {
        applyPosition(iframe, data.value);
      }
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    inject();
  } else {
    document.addEventListener("DOMContentLoaded", inject);
  }
})();
