// Network map page: how old the census is, and the link between a country on
// the map and its rows in the list. The page reads fine without it.
(function () {
  var STALE_SECS = 3 * 3600;

  var status = document.querySelector(".net-status[data-generated]");
  if (status) {
    var generated = Number(status.getAttribute("data-generated"));
    var lang = status.getAttribute("data-lang") || "en";
    var time = status.querySelector("time");
    var absolute = time.textContent;
    var rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });

    var tick = function () {
      var age = Math.max(0, Date.now() / 1000 - generated);
      var text = age < 3600 ? rtf.format(-Math.round(age / 60), "minute")
        : age < 86400 ? rtf.format(-Math.round(age / 3600), "hour")
        : rtf.format(-Math.round(age / 86400), "day");
      time.textContent = text;
      time.title = absolute;
      var stale = age > STALE_SECS;
      status.classList.toggle("is-stale", stale);
      status.querySelector(".net-fresh").hidden = stale;
      status.querySelector(".net-stale").hidden = !stale;
    };
    tick();
    var timer = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", function () {
      clearInterval(timer);
      if (!document.hidden) { tick(); timer = setInterval(tick, 60000); }
    });
  }

  var canvas = document.querySelector(".net-canvas");
  if (!canvas) return;
  var linked = document.querySelectorAll(".net-lit[data-country], .net-marker[data-country], .net-table tr[data-country]");

  var focus = function (code) {
    if (code) canvas.setAttribute("data-focus", code);
    else canvas.removeAttribute("data-focus");
    linked.forEach(function (el) {
      el.classList.toggle("is-focus", !!code && el.getAttribute("data-country") === code);
    });
  };

  document.querySelectorAll(".net-marker, .net-table tbody tr").forEach(function (el) {
    var code = el.getAttribute("data-country");
    if (!code) return;
    el.addEventListener("mouseenter", function () { focus(code); });
    el.addEventListener("mouseleave", function () { focus(null); });
    el.addEventListener("focusin", function () { focus(code); });
    el.addEventListener("focusout", function () { focus(null); });
  });
})();
