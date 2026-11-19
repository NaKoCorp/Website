// Reading aids for article pages: progress bar, table of contents with the
// current section, and the one-time reveal of figures. Everything here is an
// enhancement: without JS the article reads the same, minus these aids.
(function () {
  var article = document.querySelector("[data-article]");
  if (!article) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Progress: share of the article body scrolled past the top of the viewport.
  var bar = document.querySelector("[data-progress]");
  var body = article.querySelector(".prose");
  function progress() {
    if (!bar || !body) return;
    var r = body.getBoundingClientRect();
    var total = r.height - window.innerHeight * 0.6;
    var done = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    bar.style.transform = "scaleX(" + done.toFixed(4) + ")";
  }

  // Table of contents: built from the h2 ids the build adds.
  var toc = document.querySelector("[data-toc]");
  var heads = body ? Array.prototype.slice.call(body.querySelectorAll("h2[id]")) : [];
  var links = [];
  if (toc && heads.length > 2) {
    var list = toc.querySelector("ol");
    heads.forEach(function (h) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
      links.push(a);
    });
    toc.hidden = false;
  }
  function current() {
    if (!links.length) return;
    var line = window.innerHeight * 0.3;
    var idx = 0;
    heads.forEach(function (h, i) { if (h.getBoundingClientRect().top < line) idx = i; });
    links.forEach(function (a, i) {
      if (i === idx) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }

  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; progress(); current(); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // Figures below the fold settle in once, as they enter the viewport.
  if (!reduce && "IntersectionObserver" in window) {
    var figures = article.querySelectorAll(".prose figure, .prose .reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    Array.prototype.forEach.call(figures, function (f) {
      if (f.getBoundingClientRect().top > window.innerHeight) { f.classList.add("will-reveal"); io.observe(f); }
    });
  }
})();
