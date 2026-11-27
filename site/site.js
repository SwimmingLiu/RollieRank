(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Hero Rolling Icon Pill
     ------------------------------------------------------------------------ */
  var rotator = document.querySelector("[data-hero-rotator]");
  if (rotator) {
    var items = Array.prototype.slice.call(rotator.querySelectorAll("[data-rotator-item]"));
    var activeIdx = 0;
    var timerId = null;

    function syncRotator(nextIdx) {
      var len = items.length;
      if (!len) return;
      activeIdx = (nextIdx + len) % len;
      var prevIdx = (activeIdx - 1 + len) % len;
      var upcomingIdx = (activeIdx + 1) % len;

      items.forEach(function (el, i) {
        el.classList.remove("is-active", "is-prev", "is-next");
        if (i === activeIdx) {
          el.classList.add("is-active");
          el.removeAttribute("aria-hidden");
        } else {
          el.setAttribute("aria-hidden", "true");
          if (i === prevIdx) el.classList.add("is-prev");
          else if (i === upcomingIdx) el.classList.add("is-next");
        }
      });
    }

    function startRotator() {
      stopRotator();
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timerId = window.setInterval(function () {
        syncRotator(activeIdx + 1);
      }, 2800);
    }

    function stopRotator() {
      if (timerId) {
        window.clearInterval(timerId);
        timerId = null;
      }
    }

    rotator.addEventListener("click", function () {
      syncRotator(activeIdx + 1);
      startRotator();
    });
    rotator.addEventListener("mouseenter", stopRotator);
    rotator.addEventListener("mouseleave", startRotator);
    startRotator();
  }

  /* ------------------------------------------------------------------------
     2. Copy Miniapp Name
     ------------------------------------------------------------------------ */
  document.querySelectorAll("[data-copy-text]").forEach(function (btn) {
    var resetTimer = null;
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy-text") || "卷卷小榜";
      var label = btn.querySelector("[data-copy-label]");

      function showDone() {
        btn.classList.add("is-copied");
        if (label) label.textContent = "已复制";
        if (resetTimer) window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
          btn.classList.remove("is-copied");
          if (label) label.textContent = "复制";
        }, 1800);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showDone, showDone);
      } else {
        showDone();
      }
    });
  });

  /* ------------------------------------------------------------------------
     3. Card 1 + Card 2: Live Interactive Mini OMR Sheet <-> Radar & Score
     ------------------------------------------------------------------------ */
  var omrWidget = document.querySelector("[data-omr-widget]");
  if (omrWidget) {
    var sheet = omrWidget.querySelector("[data-omr-sheet]");
    var rows = Array.prototype.slice.call(omrWidget.querySelectorAll("[data-omr-row]"));
    var scanBtn = omrWidget.querySelector("[data-omr-scan]");
    var omrScoreEl = omrWidget.querySelector("[data-omr-score]");
    var radarScoreEl = document.querySelector("[data-radar-score]");
    var radarPoly = document.querySelector("[data-radar-poly]");
    var radarDots = document.querySelector("[data-radar-dots]");

    var baseRates = [0.88, 0.72, 0.76, 0.62, 0.81, 0.85];
    var defaultPicks = ["D", "A", "B", "D", "C", "B"];
    var scanPicks = ["D", "A", "B", "C", "C", "B"];

    var cx = 115;
    var cy = 100;
    var radius = 76;
    var angles = [-90, -30, 30, 90, 150, 210].map(function (deg) {
      return (deg * Math.PI) / 180;
    });

    function updateRadar(rates) {
      if (!radarPoly || !radarDots) return;
      var pts = [];
      var circles = radarDots.querySelectorAll("circle");
      rates.forEach(function (r, idx) {
        var clamped = Math.max(0.32, Math.min(0.98, r));
        var x = +(cx + Math.cos(angles[idx]) * radius * clamped).toFixed(1);
        var y = +(cy + Math.sin(angles[idx]) * radius * clamped).toFixed(1);
        pts.push(x + "," + y);
        if (circles[idx]) {
          circles[idx].setAttribute("cx", String(x));
          circles[idx].setAttribute("cy", String(y));
        }
      });
      radarPoly.setAttribute("points", pts.join(" "));
    }

    function recalcScore() {
      var delta = 0;
      var rates = baseRates.slice();

      rows.forEach(function (row, idx) {
        var key = row.getAttribute("data-key");
        var weight = parseFloat(row.getAttribute("data-weight") || "0.8");
        var picked = row.querySelector(".bub.is-picked");
        var val = picked ? picked.getAttribute("data-opt") : "";
        var defCorrect = defaultPicks[idx] === key;
        var nowCorrect = val === key;

        if (picked) picked.classList.toggle("is-wrong", !nowCorrect);
        if (nowCorrect !== defCorrect) delta += (nowCorrect ? 1 : -1) * weight * 4.8;
        if (nowCorrect && !defCorrect) rates[idx] = Math.min(0.95, baseRates[idx] + 0.14);
        else if (!nowCorrect && defCorrect) rates[idx] = Math.max(0.42, baseRates[idx] - 0.16);
      });

      var score = (78.4 + delta).toFixed(2);
      if (omrScoreEl) omrScoreEl.textContent = score;
      if (radarScoreEl) radarScoreEl.textContent = score;
      updateRadar(rates);
    }

    rows.forEach(function (row) {
      var buttons = Array.prototype.slice.call(row.querySelectorAll(".bub"));
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          buttons.forEach(function (b) {
            var on = b === btn;
            b.classList.toggle("is-picked", on);
            b.classList.remove("is-wrong");
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          recalcScore();
        });
      });
    });

    var scanning = false;
    var scanToggle = false;
    if (scanBtn && sheet) {
      scanBtn.addEventListener("click", function () {
        if (scanning) return;
        scanning = true;
        scanToggle = !scanToggle;
        var targetPicks = scanToggle ? scanPicks : defaultPicks;

        sheet.classList.remove("is-scanning");
        void sheet.offsetWidth;
        sheet.classList.add("is-scanning");

        rows.forEach(function (row, idx) {
          window.setTimeout(function () {
            row.classList.add("is-flash");
            var want = targetPicks[idx];
            row.querySelectorAll(".bub").forEach(function (b) {
              var on = b.getAttribute("data-opt") === want;
              b.classList.toggle("is-picked", on);
              b.classList.remove("is-wrong");
              b.setAttribute("aria-pressed", on ? "true" : "false");
            });
            recalcScore();
            window.setTimeout(function () {
              row.classList.remove("is-flash");
            }, 260);
          }, 120 + idx * 125);
        });

        window.setTimeout(function () {
          sheet.classList.remove("is-scanning");
          scanning = false;
        }, 1100);
      });
    }

    var pasteBtn = omrWidget.querySelector("[data-paste-cycle]");
    var pasteSample = omrWidget.querySelector("[data-paste-sample]");
    if (pasteBtn && pasteSample) {
      var samples = ["1-5 DABDC", "1.D 2.A 3.B", "DABDCC"];
      var sampleIdx = 0;
      pasteBtn.addEventListener("click", function () {
        sampleIdx = (sampleIdx + 1) % samples.length;
        pasteSample.textContent = samples[sampleIdx];
      });
    }
  }

  /* ------------------------------------------------------------------------
     4. 130 <-> 135 Weight Switcher (Compact 6-row on Home & 3x3 9-tile on Topic)
     ------------------------------------------------------------------------ */
  var PAPERS_6 = {
    "130": [
      { name: "政治", count: 20, score: "10", unit: "0.50/题", pct: 35, diff: false },
      { name: "常识", count: 15, score: "7.5", unit: "0.50/题", pct: 26, diff: false },
      { name: "言语", count: 30, score: "24", unit: "0.80/题", pct: 84, diff: false },
      { name: "数量", count: 10, score: "10", unit: "1.00/题", pct: 35, diff: true },
      { name: "判断", count: 35, score: "28.5", unit: "0.81/题", pct: 100, diff: true },
      { name: "资料", count: 20, score: "20", unit: "1.00/题", pct: 70, diff: false }
    ],
    "135": [
      { name: "政治", count: 20, score: "10", unit: "0.50/题", pct: 35, diff: false },
      { name: "常识", count: 15, score: "7.5", unit: "0.50/题", pct: 26, diff: false },
      { name: "言语", count: 30, score: "24", unit: "0.80/题", pct: 84, diff: false },
      { name: "数量", count: 15, score: "12", unit: "0.80/题", pct: 42, diff: true },
      { name: "判断", count: 35, score: "26.5", unit: "0.76/题", pct: 93, diff: true },
      { name: "资料", count: 20, score: "20", unit: "1.00/题", pct: 70, diff: false }
    ]
  };

  var PAPERS_9 = {
    "130": [
      { name: "政治理论", count: 20, score: "10", unit: "0.50/题", pct: 42, diff: false },
      { name: "常识判断", count: 15, score: "7.5", unit: "0.50/题", pct: 31, diff: false },
      { name: "言语理解", count: 30, score: "24", unit: "0.80/题", pct: 100, diff: false },
      { name: "数量关系", count: 10, score: "10", unit: "1.00/题", pct: 42, diff: true },
      { name: "图形推理", count: 10, score: "8", unit: "0.80/题", pct: 33, diff: false },
      { name: "定义判断", count: 10, score: "8", unit: "0.80/题", pct: 33, diff: false },
      { name: "类比推理", count: 5, score: "4", unit: "0.80/题", pct: 17, diff: true },
      { name: "逻辑判断", count: 10, score: "8.5", unit: "0.85/题", pct: 35, diff: true },
      { name: "资料分析", count: 20, score: "20", unit: "1.00/题", pct: 83, diff: false }
    ],
    "135": [
      { name: "政治理论", count: 20, score: "10", unit: "0.50/题", pct: 42, diff: false },
      { name: "常识判断", count: 15, score: "7.5", unit: "0.50/题", pct: 31, diff: false },
      { name: "言语理解", count: 30, score: "24", unit: "0.80/题", pct: 100, diff: false },
      { name: "数量关系", count: 15, score: "12", unit: "0.80/题", pct: 50, diff: true },
      { name: "图形推理", count: 10, score: "8", unit: "0.80/题", pct: 33, diff: false },
      { name: "定义判断", count: 10, score: "8", unit: "0.80/题", pct: 33, diff: false },
      { name: "类比推理", count: 5, score: "2.5", unit: "0.50/题", pct: 10, diff: true },
      { name: "逻辑判断", count: 10, score: "8", unit: "0.80/题", pct: 33, diff: true },
      { name: "资料分析", count: 20, score: "20", unit: "1.00/题", pct: 83, diff: false }
    ]
  };

  document.querySelectorAll("[data-paper-switcher]").forEach(function (switcher) {
    var paperBtns = Array.prototype.slice.call(switcher.querySelectorAll("[data-paper-btn]"));
    var grid6 = switcher.querySelector("[data-paper-grid]");
    var grid9 = switcher.querySelector("[data-paper-subgrid]");

    function render(type) {
      if (grid6) {
        var list6 = PAPERS_6[type] || PAPERS_6["130"];
        var rowEls = grid6.querySelectorAll(".wrow");
        list6.forEach(function (item, idx) {
          var row = rowEls[idx];
          if (!row) return;
          row.classList.toggle("is-diff", item.diff);
          var fill = row.querySelector(".wrow__bar i");
          var val = row.querySelector(".wrow__val");
          var unit = row.querySelector(".wrow__unit");
          if (fill) fill.style.width = item.pct + "%";
          if (val) val.innerHTML = "<b>" + item.count + "</b>题 · " + item.score + "分";
          if (unit) unit.textContent = item.unit;
        });
      }
      if (grid9) {
        var list9 = PAPERS_9[type] || PAPERS_9["130"];
        grid9.innerHTML = list9
          .map(function (item) {
            return (
              '<div class="subtile' + (item.diff ? " is-diff" : "") + '">' +
              '<div class="subtile__top"><strong>' + item.name + (item.diff ? '<i class="diff-dot" aria-hidden="true"></i>' : "") + "</strong>" +
              '<span class="subtile__unit">' + item.unit + "</span></div>" +
              '<span class="subtile__bar"><i style="width:' + item.pct + '%"></i></span>' +
              '<span class="subtile__meta">' + item.count + " 题 · " + item.score + " 分</span>" +
              "</div>"
            );
          })
          .join("");
      }
    }

    paperBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-paper-btn");
        paperBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        render(type);
      });
    });

    if (grid9) render("130");
  });

  /* ------------------------------------------------------------------------
     5. Card 4A: National <-> Position Rank Toggle
     ------------------------------------------------------------------------ */
  var rankWidget = document.querySelector("[data-rank-widget]");
  if (rankWidget) {
    var rankBtns = Array.prototype.slice.call(rankWidget.querySelectorAll("[data-rank-btn]"));
    var rankRows = Array.prototype.slice.call(rankWidget.querySelectorAll(".rrow"));

    var RANKS = {
      national: [
        { pos: "1", pct: 92, val: "83.6", me: false },
        { pos: "2", pct: 82, val: "78.4 · 我", me: true },
        { pos: "3", pct: 72, val: "74.2", me: false }
      ],
      position: [
        { pos: "1", pct: 89, val: "80.2", me: false },
        { pos: "2", pct: 85, val: "78.4 · 我", me: true },
        { pos: "3", pct: 71, val: "72.8", me: false }
      ]
    };

    rankBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-rank-btn");
        var data = RANKS[key] || RANKS.national;
        rankBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        data.forEach(function (item, idx) {
          var row = rankRows[idx];
          if (!row) return;
          row.classList.toggle("is-me", item.me);
          var pos = row.querySelector(".rpos");
          var bar = row.querySelector(".rbar i");
          var val = row.querySelector(".rval");
          if (pos) pos.textContent = item.pos;
          if (bar) bar.style.width = item.pct + "%";
          if (val) val.textContent = item.val;
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. Card 4B: Dual Timer Pill Indicator
     ------------------------------------------------------------------------ */
  var timerWidget = document.querySelector("[data-timer-widget]");
  if (timerWidget) {
    var solveEl = timerWidget.querySelector("[data-timer-solve]");
    var entryEl = timerWidget.querySelector("[data-timer-entry]");
    var modeBtns = Array.prototype.slice.call(timerWidget.querySelectorAll("[data-timer-mode]"));
    var toggleBtn = timerWidget.querySelector("[data-timer-toggle]");
    var stateEl = timerWidget.querySelector("[data-timer-state]");

    var secs = { solve: 118 * 60 + 42, entry: 3 * 60 + 15 };
    var currentMode = "solve";
    var running = false;
    var tickId = null;

    function fmt(total) {
      var m = Math.floor(total / 60);
      var s = total % 60;
      return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    function setRunning(next) {
      running = next;
      if (toggleBtn) toggleBtn.setAttribute("aria-pressed", running ? "true" : "false");
      if (stateEl) stateEl.textContent = running ? "计时中" : "暂停";
      if (tickId) {
        window.clearInterval(tickId);
        tickId = null;
      }
      if (running) {
        tickId = window.setInterval(function () {
          secs[currentMode] += 1;
          if (solveEl) solveEl.textContent = fmt(secs.solve);
          if (entryEl) entryEl.textContent = fmt(secs.entry);
        }, 1000);
      }
    }

    modeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentMode = btn.getAttribute("data-timer-mode") || "solve";
        modeBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (!running) setRunning(true);
      });
    });

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        setRunning(!running);
      });
    }
  }

  /* ------------------------------------------------------------------------
     7. Dark Gallery Interactive Spotlight Focus
     ------------------------------------------------------------------------ */
  var galleryCards = Array.prototype.slice.call(document.querySelectorAll("[data-gcard]"));
  if (galleryCards.length) {
    galleryCards.forEach(function (card) {
      function focusCard() {
        galleryCards.forEach(function (c) {
          c.classList.toggle("is-featured", c === card);
        });
      }
      card.addEventListener("mouseenter", focusCard);
      card.addEventListener("click", focusCard);
      card.addEventListener("focus", focusCard);
    });
  }

  /* ------------------------------------------------------------------------
     8. Adaptive Dark Topbar over Dark Espresso Gallery Band
     ------------------------------------------------------------------------ */
  var topbar = document.querySelector("[data-topbar]");
  var darkZone = document.querySelector("[data-dark-zone]");
  if (topbar && darkZone) {
    function syncTopbarTheme() {
      var rect = darkZone.getBoundingClientRect();
      var headerMid = 40;
      topbar.classList.toggle("is-dark", rect.top <= headerMid && rect.bottom >= headerMid);
    }
    syncTopbarTheme();
    window.addEventListener("scroll", syncTopbarTheme, { passive: true });
    window.addEventListener("resize", syncTopbarTheme, { passive: true });
  }

  /* ------------------------------------------------------------------------
     9. Desktop QR Modal (#qr-modal) with live API refresh fallback
     ------------------------------------------------------------------------ */
  var modal = document.getElementById("qr-modal");
  if (modal) {
    var qrImg = modal.querySelector("[data-qr-img]");
    var fetchedQr = false;
    var lastFocus = null;

    function openModal() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      var closeBtn = modal.querySelector("[data-close-qr]");
      if (closeBtn) closeBtn.focus();
      if (!fetchedQr && qrImg) {
        fetchedQr = true;
        fetch("/api/miniapp/qrcode", { credentials: "omit" })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (d) {
            if (d && d.image) {
              qrImg.src = "data:" + (d.mime || "image/jpeg") + ";base64," + d.image;
            }
          })
          .catch(function () { /* keep static fallback */ });
      }
    }

    function closeModal() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    document.querySelectorAll("[data-open-qr]").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        openModal();
      });
    });

    modal.querySelectorAll("[data-close-qr]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", function (ev) {
      if (ev.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeModal();
    });
  }
})();
