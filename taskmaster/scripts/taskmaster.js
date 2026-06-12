(function () {
  "use strict";

  var STORAGE_KEY = "tds-taskmaster-scores";
  var PROGRESS_KEY = "tds-taskmaster-progress";
  var TASK_ORDER = ["task-1", "task-2", "task-3", "task-3-5", "task-4", "task-5"];
  var ROUND_NAMES = ["Round 1", "Round 2", "Round 3", "Bonus Round 3.5", "Round 4", "Round 5"];
  var ROUND_DESCRIPTIONS = [
    "Score each contestant 0–8 points for Round 1.",
    "Score each contestant 0–8 points for Round 2.",
    "Score each contestant 0–10 points for Round 3.",
    "Bonus anagram round — award +2 points to one contestant only.",
    "Score each contestant 0–8 points for Round 4.",
    "Score each contestant 0–8 points for Round 5."
  ];
  var ROUND_MAX_POINTS = [8, 8, 10, null, 8, 8];
  var BONUS_ROUND_INDEX = 3;
  var BONUS_POINTS = 2;
  var INITIAL_SETUP_SLOTS = 6;
  var MAX_CONTESTANTS = 24;

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var state = JSON.parse(raw);
      if (!state.adjustments) state.adjustments = [];
      return state;
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { completed: [] };
      var data = JSON.parse(raw);
      if (!data.completed) data.completed = [];
      return data;
    } catch (e) {
      return { completed: [] };
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function isTaskUnlocked(taskId, completed) {
    var index = TASK_ORDER.indexOf(taskId);
    if (index <= 0) return true;
    return completed.indexOf(TASK_ORDER[index - 1]) !== -1;
  }

  function defaultScores(count) {
    var scores = [];
    for (var i = 0; i < count; i++) {
      scores.push([0, 0, 0, 0, 0, 0]);
    }
    return scores;
  }

  function defaultAdjustments(count) {
    var adjustments = [];
    for (var i = 0; i < count; i++) {
      adjustments.push(0);
    }
    return adjustments;
  }

  function getRoundTotal(scores, index, roundIndex) {
    return scores[index][roundIndex] || 0;
  }

  function getBaseTotal(scores, index) {
    var total = 0;
    for (var r = 0; r < scores[index].length; r++) {
      total += scores[index][r] || 0;
    }
    return total;
  }

  function getTotalForContestant(scores, adjustments, index) {
    return getBaseTotal(scores, index) + (adjustments[index] || 0);
  }

  /* ── Envelope / modal (homepage) ── */

  function removeStalePlaceholderNodes() {
    document.querySelectorAll("#task-image-missing, .task-image-missing").forEach(function (el) {
      el.remove();
    });
  }

  function initEnvelopes() {
    removeStalePlaceholderNodes();

    var modal = document.getElementById("task-modal");
    if (!modal) return;

    var img = modal.querySelector(".task-card-image");
    var modalActions = modal.querySelector(".task-modal-actions");
    var backBtn = modal.querySelector(".task-modal-back");
    var completeBtn = document.getElementById("task-complete-btn");
    var incompleteBtn = document.getElementById("task-incomplete-btn");
    var startQuizBtn = document.getElementById("start-quiz-btn");
    var taskTimerEl = document.getElementById("task-timer");
    var taskTimerDisplay = document.getElementById("task-timer-display");
    var taskTimerLabel = taskTimerEl ? taskTimerEl.querySelector(".task-timer-label") : null;
    var taskTimerStartBtn = document.getElementById("task-timer-start");
    var taskTimerResetBtn = document.getElementById("task-timer-reset");
    var focusableSelector = 'button:not([disabled]):not([hidden]), a[href]:not([hidden]), input:not([hidden]), [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;
    var activeTaskId = null;
    var progress = loadProgress();
    var TASK_TIMER_CONFIG = {
      "task-2": { seconds: 15 * 60, label: "15-minute task timer" },
      "task-4": { seconds: 5 * 60, label: "5-minute task timer" }
    };
    var taskTimerStates = {};
    var activeTimerTaskId = null;
    var taskTimerInterval = null;

    function getTaskTimerConfig(taskId) {
      return TASK_TIMER_CONFIG[taskId] || null;
    }

    function getTaskTimerState(taskId) {
      if (!taskTimerStates[taskId]) {
        taskTimerStates[taskId] = { endAt: null, pausedSeconds: null, finished: false };
      }
      return taskTimerStates[taskId];
    }

    function getActiveTimerDuration() {
      var config = activeTimerTaskId ? getTaskTimerConfig(activeTimerTaskId) : null;
      return config ? config.seconds : 0;
    }

    function applyTaskProgress() {
      document.querySelectorAll(".envelope-wrap").forEach(function (wrap) {
        var taskId = wrap.dataset.taskId;
        var envelope = wrap.querySelector(".envelope");
        if (!taskId || !envelope) return;

        var completed = progress.completed.indexOf(taskId) !== -1;
        var unlocked = isTaskUnlocked(taskId, progress.completed);

        wrap.classList.toggle("completed", completed);
        wrap.classList.toggle("locked", !unlocked);

        envelope.disabled = !unlocked;
        envelope.setAttribute("aria-disabled", unlocked ? "false" : "true");

        var baseLabel = envelope.dataset.baseLabel || envelope.getAttribute("aria-label");
        if (!envelope.dataset.baseLabel) envelope.dataset.baseLabel = baseLabel;
        envelope.setAttribute("aria-label", baseLabel + (completed ? " (completed)" : ""));
      });
    }

    function trapFocus(event) {
      if (!modal.classList.contains("visible")) return;
      if (event.key !== "Tab") return;
      var focusable = modal.querySelectorAll(focusableSelector);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function getTaskImageCandidates(taskBase) {
      var names = [taskBase];
      if (taskBase === "task-3-5") names.push("task-3.5");
      var extensions = ["svg", "png", "jpg", "jpeg", "webp"];
      var candidates = [];
      names.forEach(function (name) {
        extensions.forEach(function (ext) {
          candidates.push(name + "." + ext);
        });
      });
      return candidates;
    }

    function setModalActionsVisible(visible) {
      if (modalActions) modalActions.hidden = !visible;
    }

    function setTaskImage(taskBase) {
      removeStalePlaceholderNodes();

      var basePath = new URL("assets/tasks/", window.location.href).href;
      var cacheBust = "?v=" + Date.now();
      var candidates = getTaskImageCandidates(taskBase);
      var attempt = 0;

      img.hidden = true;
      img.classList.remove("loaded");
      img.classList.remove("loading");
      setModalActionsVisible(false);

      img.onload = function () {
        img.classList.remove("loading");
        img.classList.add("loaded");
        img.hidden = false;
        setModalActionsVisible(true);
      };

      img.onerror = function () {
        attempt += 1;
        if (attempt < candidates.length) {
          img.src = basePath + candidates[attempt] + cacheBust;
          return;
        }
        img.onerror = null;
        img.classList.remove("loading");
        img.hidden = true;
        img.removeAttribute("src");
        setModalActionsVisible(true);
      };

      img.src = basePath + candidates[0] + cacheBust;
    }

    function setStartQuizVisible(visible) {
      if (!startQuizBtn) return;
      startQuizBtn.hidden = !visible;
      startQuizBtn.classList.toggle("is-hidden", !visible);
      startQuizBtn.setAttribute("aria-hidden", visible ? "false" : "true");
      if (visible) {
        startQuizBtn.href = "quiz.html?new=1";
        startQuizBtn.removeAttribute("tabindex");
      } else {
        startQuizBtn.setAttribute("tabindex", "-1");
      }
    }

    function formatTimerDisplay(totalSeconds) {
      var seconds = Math.max(0, totalSeconds);
      var minutes = Math.floor(seconds / 60);
      var remainder = seconds % 60;
      return String(minutes) + ":" + (remainder < 10 ? "0" : "") + remainder;
    }

    function getTaskTimerRemaining() {
      if (!activeTimerTaskId) return 0;
      var state = getTaskTimerState(activeTimerTaskId);
      var duration = getActiveTimerDuration();
      if (state.finished) return 0;
      if (state.endAt) return Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000));
      if (state.pausedSeconds !== null) return state.pausedSeconds;
      return duration;
    }

    function isTaskTimerRunning() {
      if (!activeTimerTaskId) return false;
      var state = getTaskTimerState(activeTimerTaskId);
      return state.endAt !== null && getTaskTimerRemaining() > 0;
    }

    function stopTaskTimerInterval() {
      if (taskTimerInterval) {
        clearInterval(taskTimerInterval);
        taskTimerInterval = null;
      }
    }

    function updateTaskTimerUI() {
      if (!taskTimerDisplay || !taskTimerStartBtn || !activeTimerTaskId) return;
      var state = getTaskTimerState(activeTimerTaskId);
      var duration = getActiveTimerDuration();
      var remaining = getTaskTimerRemaining();

      if (remaining === 0 && state.endAt !== null) {
        state.endAt = null;
        state.finished = true;
        stopTaskTimerInterval();
      }

      taskTimerDisplay.textContent = formatTimerDisplay(remaining);
      taskTimerDisplay.classList.toggle("task-timer-display--warning", remaining > 0 && remaining <= 60);
      taskTimerDisplay.classList.toggle("task-timer-display--done", remaining === 0 && state.finished);

      if (state.finished) {
        taskTimerStartBtn.textContent = "Time's up!";
        taskTimerStartBtn.disabled = true;
      } else if (isTaskTimerRunning()) {
        taskTimerStartBtn.textContent = "Pause";
        taskTimerStartBtn.disabled = false;
      } else {
        taskTimerStartBtn.textContent = state.pausedSeconds !== null ? "Resume" : "Start Timer";
        taskTimerStartBtn.disabled = false;
      }
    }

    function startTaskTimerTick() {
      stopTaskTimerInterval();
      updateTaskTimerUI();
      taskTimerInterval = setInterval(updateTaskTimerUI, 250);
    }

    function setTaskTimerVisible(visible, taskId) {
      if (!taskTimerEl) return;
      var config = visible && taskId ? getTaskTimerConfig(taskId) : null;
      var show = !!config;
      taskTimerEl.hidden = !show;
      taskTimerEl.classList.toggle("is-hidden", !show);
      taskTimerEl.setAttribute("aria-hidden", show ? "false" : "true");
      if (show) {
        activeTimerTaskId = taskId;
        if (taskTimerLabel) taskTimerLabel.textContent = config.label;
        updateTaskTimerUI();
        if (isTaskTimerRunning()) startTaskTimerTick();
      }
    }

    function startOrPauseTaskTimer() {
      if (!activeTimerTaskId) return;
      var state = getTaskTimerState(activeTimerTaskId);
      var duration = getActiveTimerDuration();

      if (isTaskTimerRunning()) {
        state.pausedSeconds = getTaskTimerRemaining();
        state.endAt = null;
        stopTaskTimerInterval();
        updateTaskTimerUI();
        return;
      }

      var seconds = state.pausedSeconds !== null ? state.pausedSeconds : duration;
      state.pausedSeconds = null;
      state.finished = false;
      if (!seconds || seconds <= 0) seconds = duration;
      state.endAt = Date.now() + seconds * 1000;
      startTaskTimerTick();
    }

    function resetTaskTimer() {
      if (!activeTimerTaskId) return;
      var state = getTaskTimerState(activeTimerTaskId);
      stopTaskTimerInterval();
      state.endAt = null;
      state.pausedSeconds = null;
      state.finished = false;
      updateTaskTimerUI();
    }

    function updateTaskButtons(taskId) {
      var alreadyDone = progress.completed.indexOf(taskId) !== -1;
      setStartQuizVisible(taskId === "task-3");
      setTaskTimerVisible(!!getTaskTimerConfig(taskId), taskId);
      if (completeBtn) {
        completeBtn.hidden = alreadyDone;
        completeBtn.disabled = false;
      }
      if (incompleteBtn) {
        incompleteBtn.hidden = !alreadyDone;
      }
    }

    function openModal(taskId, taskBase) {
      removeStalePlaceholderNodes();
      activeTaskId = taskId;
      img.alt = "Loading task card…";
      setTaskImage(taskBase);
      updateTaskButtons(taskId);

      modal.classList.add("visible");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      lastFocused = document.activeElement;
      if (backBtn) backBtn.focus();

      img.alt = taskId.replace(/-/g, " ");
    }

    function closeModal() {
      modal.classList.remove("visible");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      activeTaskId = null;
      setStartQuizVisible(false);
      setTaskTimerVisible(false);
      img.removeAttribute("src");
      img.hidden = true;
      img.classList.remove("loading", "loaded");
      setModalActionsVisible(false);
      document.querySelectorAll(".envelope.open").forEach(function (env) {
        env.classList.remove("open");
      });
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function markTaskComplete() {
      if (!activeTaskId) return;
      if (progress.completed.indexOf(activeTaskId) === -1) {
        progress.completed.push(activeTaskId);
        saveProgress(progress);
      }
      applyTaskProgress();
      updateTaskButtons(activeTaskId);
      closeModal();
    }

    function markTaskIncomplete() {
      if (!activeTaskId) return;
      var taskIndex = TASK_ORDER.indexOf(activeTaskId);
      if (taskIndex === -1) return;

      progress.completed = progress.completed.filter(function (taskId) {
        return TASK_ORDER.indexOf(taskId) < taskIndex;
      });
      saveProgress(progress);
      applyTaskProgress();
      closeModal();
    }

    document.querySelectorAll(".envelope-wrap").forEach(function (wrap) {
      var envelope = wrap.querySelector(".envelope");
      if (!envelope) return;

      envelope.addEventListener("click", function () {
        if (envelope.disabled) return;
        var taskId = wrap.dataset.taskId;
        var taskBase = envelope.dataset.task;
        if (!taskId || !taskBase) return;
        envelope.classList.add("open");
        setTimeout(function () {
          openModal(taskId, taskBase);
        }, 400);
      });

      envelope.addEventListener("keydown", function (event) {
        if (envelope.disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          envelope.click();
        }
      });
    });

    if (backBtn) backBtn.addEventListener("click", closeModal);
    if (completeBtn) completeBtn.addEventListener("click", markTaskComplete);
    if (incompleteBtn) incompleteBtn.addEventListener("click", markTaskIncomplete);
    if (taskTimerStartBtn) taskTimerStartBtn.addEventListener("click", startOrPauseTaskTimer);
    if (taskTimerResetBtn) taskTimerResetBtn.addEventListener("click", resetTaskTimer);
    if (taskTimerDisplay) {
      taskTimerDisplay.addEventListener("click", function () {
        if (taskTimerStartBtn && taskTimerStartBtn.disabled) return;
        startOrPauseTaskTimer();
      });
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("visible")) {
        closeModal();
      }
      trapFocus(event);
    });

    applyTaskProgress();
  }

  /* ── Scoreboard ── */

  function initScoreboard() {
    var setupEl = document.getElementById("scoreboard-setup");
    var scoringEl = document.getElementById("scoreboard-scoring");
    var leaderboardEl = document.getElementById("scoreboard-leaderboard");
    var podiumEl = document.getElementById("scoreboard-podium");
    if (!setupEl || !scoringEl || !leaderboardEl) return;

    var setupForm = document.getElementById("setup-form");
    var setupGrid = setupForm ? setupForm.querySelector(".setup-grid") : null;
    var startBtn = document.getElementById("start-games-btn");
    var addContestantBtn = document.getElementById("add-contestant-btn");
    var roundTabs = document.getElementById("round-tabs");
    var roundTitle = document.getElementById("round-title");
    var roundDescription = document.getElementById("round-description");
    var scoringCards = document.getElementById("scoring-cards");
    var viewLeaderboardBtn = document.getElementById("view-leaderboard-btn");
    var backToScoringBtn = document.getElementById("back-to-scoring-btn");
    var resetBtn = document.getElementById("reset-everything-btn");
    var resetConfirmModal = document.getElementById("reset-confirm-modal");
    var resetConfirmYesBtn = document.getElementById("reset-confirm-yes");
    var resetConfirmCancelBtn = document.getElementById("reset-confirm-cancel");
    var leaderboardList = document.getElementById("leaderboard-list");
    var winnersPodiumBtn = document.getElementById("winners-podium-btn");
    var podiumWinnerName = document.getElementById("podium-winner-name");
    var podiumWinnerSub = document.getElementById("podium-winner-sub");
    var podiumMiniTableBody = document.getElementById("podium-mini-table-body");
    var podiumBackBtn = document.getElementById("podium-back-btn");
    var resetConfirmLastFocused = null;

    var state = loadState() || {
      names: [],
      scores: [],
      adjustments: [],
      currentRound: 0,
      started: false,
      setupSlotCount: INITIAL_SETUP_SLOTS
    };
    if (!state.setupSlotCount) {
      state.setupSlotCount = Math.max(INITIAL_SETUP_SLOTS, state.names.length);
    }

    function showView(view) {
      setupEl.classList.remove("active");
      scoringEl.classList.remove("active");
      leaderboardEl.classList.remove("active");
      if (podiumEl) podiumEl.classList.remove("active");
      view.classList.add("active");
    }

    function getActiveNames() {
      return state.names.filter(function (n) {
        return n && n.trim();
      });
    }

    function ensureAdjustments() {
      if (!state.adjustments || state.adjustments.length !== state.names.length) {
        state.adjustments = defaultAdjustments(state.names.length);
      }
    }

    function collectNamesFromForm() {
      if (!setupGrid) return [];
      var inputs = setupGrid.querySelectorAll(".setup-field input");
      var names = [];
      for (var i = 0; i < inputs.length; i++) {
        names.push(inputs[i].value.trim());
      }
      return names;
    }

    function getSetupSlotCount() {
      var fromForm = setupGrid ? setupGrid.querySelectorAll(".setup-field").length : 0;
      var count = state.setupSlotCount || INITIAL_SETUP_SLOTS;
      count = Math.max(count, INITIAL_SETUP_SLOTS, state.names.length, fromForm);
      return Math.min(count, MAX_CONTESTANTS);
    }

    function updateAddContestantButton() {
      if (!addContestantBtn) return;
      var atMax = getSetupSlotCount() >= MAX_CONTESTANTS;
      addContestantBtn.disabled = atMax;
      addContestantBtn.textContent = atMax
        ? "Maximum contestants reached"
        : "+ Add Contestant";
    }

    function rebuildSetupGrid() {
      if (!setupGrid) return;
      var existing = collectNamesFromForm();
      var slotCount = getSetupSlotCount();
      if (existing.length > slotCount) slotCount = existing.length;
      state.setupSlotCount = slotCount;

      setupGrid.innerHTML = "";
      for (var i = 0; i < slotCount; i++) {
        var field = document.createElement("div");
        field.className = "setup-field";
        var label = document.createElement("label");
        label.setAttribute("for", "contestant-" + i);
        label.textContent = "Contestant " + (i + 1);
        var input = document.createElement("input");
        input.type = "text";
        input.id = "contestant-" + i;
        input.name = "contestant-" + i;
        input.maxLength = 32;
        input.autocomplete = "off";
        input.placeholder = i < 2 ? "Required" : "Name";
        if (existing[i]) {
          input.value = existing[i];
        } else if (state.names[i]) {
          input.value = state.names[i];
        }
        field.appendChild(label);
        field.appendChild(input);
        setupGrid.appendChild(field);
      }
      updateAddContestantButton();
    }

    function addContestantSlot() {
      if (getSetupSlotCount() >= MAX_CONTESTANTS) return;
      state.names = collectNamesFromForm();
      state.setupSlotCount = getSetupSlotCount() + 1;
      saveState(state);
      rebuildSetupGrid();
      var lastInput = document.getElementById("contestant-" + (state.setupSlotCount - 1));
      if (lastInput) lastInput.focus();
    }

    function ensureScoresLength(count) {
      while (state.scores.length < count) {
        state.scores.push([0, 0, 0, 0, 0, 0]);
      }
      while (state.adjustments.length < count) {
        state.adjustments.push(0);
      }
    }

    function startGames() {
      var names = collectNamesFromForm();
      var active = names.filter(function (n) { return n; });
      if (active.length < 2) {
        alert("Please enter at least 2 contestant names.");
        return;
      }
      state.names = names;
      state.setupSlotCount = names.length;
      ensureScoresLength(names.length);
      ensureAdjustments();
      state.started = true;
      state.currentRound = 0;
      saveState(state);
      renderScoring();
      showView(scoringEl);
    }

    function renderRoundTabs() {
      roundTabs.innerHTML = "";
      ROUND_NAMES.forEach(function (name, index) {
        var tab = document.createElement("button");
        tab.type = "button";
        tab.className = "round-tab" + (index === BONUS_ROUND_INDEX ? " bonus-tab" : "");
        if (index === state.currentRound) tab.classList.add("active");
        tab.textContent = index === BONUS_ROUND_INDEX ? "Bonus" : "R" + (index < BONUS_ROUND_INDEX ? index + 1 : index);
        tab.setAttribute("aria-label", "Switch to " + name);
        tab.addEventListener("click", function () {
          state.currentRound = index;
          saveState(state);
          renderScoring();
        });
        roundTabs.appendChild(tab);
      });
    }

    function renderPointPicker(contestantIndex, currentScore, maxPoints) {
      var wrap = document.createElement("div");
      wrap.className = "point-picker" + (maxPoints >= 10 ? " point-picker--dense" : "");
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", "Score for contestant");

      for (var p = 0; p <= maxPoints; p++) {
        (function (pointValue) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "point-btn" + (pointValue === currentScore ? " active" : "");
          btn.textContent = String(pointValue);
          btn.setAttribute("aria-label", "Score " + pointValue + " out of " + maxPoints);
          btn.setAttribute("aria-pressed", pointValue === currentScore ? "true" : "false");
          btn.addEventListener("click", function () {
            state.scores[contestantIndex][state.currentRound] = pointValue;
            saveState(state);
            renderScoring();
          });
          wrap.appendChild(btn);
        })(p);
      }
      return wrap;
    }

    function renderBonusToggle(contestantIndex, currentScore) {
      var wrap = document.createElement("div");
      wrap.className = "bonus-toggle-group";
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", "Bonus round points");

      var yesBtn = document.createElement("button");
      yesBtn.type = "button";
      yesBtn.className = "bonus-btn" + (currentScore === BONUS_POINTS ? " active-yes" : "");
      yesBtn.textContent = "+" + BONUS_POINTS;
      yesBtn.setAttribute("aria-label", "Award " + BONUS_POINTS + " bonus points");
      yesBtn.addEventListener("click", function () {
        for (var i = 0; i < state.scores.length; i++) {
          state.scores[i][BONUS_ROUND_INDEX] = i === contestantIndex ? BONUS_POINTS : 0;
        }
        saveState(state);
        renderScoring();
      });

      var noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "bonus-btn" + (currentScore === 0 ? " active-no" : "");
      noBtn.textContent = "0";
      noBtn.setAttribute("aria-label", "No bonus points");
      noBtn.addEventListener("click", function () {
        state.scores[contestantIndex][BONUS_ROUND_INDEX] = 0;
        saveState(state);
        renderScoring();
      });

      wrap.appendChild(yesBtn);
      wrap.appendChild(noBtn);
      return wrap;
    }

    function formatRunningTotal(index) {
      var base = getBaseTotal(state.scores, index);
      var adj = state.adjustments[index] || 0;
      if (adj !== 0) {
        return String(base + adj) + " (" + base + (adj > 0 ? "+" : "") + adj + ")";
      }
      return String(base);
    }

    function renderScoring() {
      ensureAdjustments();
      renderRoundTabs();
      if (roundTitle) {
        roundTitle.textContent = ROUND_NAMES[state.currentRound];
      }
      if (roundDescription) {
        roundDescription.textContent = ROUND_DESCRIPTIONS[state.currentRound];
      }
      if (!scoringCards) return;
      scoringCards.innerHTML = "";

      var maxPoints = ROUND_MAX_POINTS[state.currentRound];

      state.names.forEach(function (name, index) {
        if (!name) return;

        var card = document.createElement("article");
        card.className = "scoring-card";

        var nameEl = document.createElement("span");
        nameEl.className = "scoring-name";
        nameEl.textContent = name;

        var pickerWrap = document.createElement("div");
        pickerWrap.className = "scoring-card-picker";
        var roundScore = getRoundTotal(state.scores, index, state.currentRound);
        if (state.currentRound === BONUS_ROUND_INDEX) {
          pickerWrap.appendChild(renderBonusToggle(index, roundScore));
        } else {
          pickerWrap.appendChild(renderPointPicker(index, roundScore, maxPoints));
        }

        var totalEl = document.createElement("span");
        totalEl.className = "scoring-total";
        totalEl.setAttribute("aria-label", "Running total");
        totalEl.textContent = formatRunningTotal(index);

        card.appendChild(nameEl);
        card.appendChild(pickerWrap);
        card.appendChild(totalEl);
        scoringCards.appendChild(card);
      });
    }

    function getLeaderboardEntries() {
      ensureAdjustments();
      return state.names
        .map(function (name, index) {
          var base = getBaseTotal(state.scores, index);
          var adj = state.adjustments[index] || 0;
          return {
            name: name,
            index: index,
            base: base,
            adjustment: adj,
            total: base + adj
          };
        })
        .filter(function (e) { return e.name; })
        .sort(function (a, b) { return b.total - a.total; });
    }

    function getPodiumRankLabel(position) {
      if (position === 0) return "🥇";
      if (position === 1) return "🥈";
      if (position === 2) return "🥉";
      return String(position + 1);
    }

    function renderLeaderboard() {
      leaderboardList.innerHTML = "";

      var entries = getLeaderboardEntries();

      var maxScore = entries.length ? entries[0].total : 1;
      if (maxScore <= 0) maxScore = 1;

      entries.forEach(function (entry, position) {
        var li = document.createElement("li");
        li.className = "leaderboard-item";

        var rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        if (position === 0) rank.textContent = "🥇";
        else if (position === 1) rank.textContent = "🥈";
        else if (position === 2) rank.textContent = "🥉";
        else rank.textContent = "#" + (position + 1);

        var nameWrap = document.createElement("div");
        nameWrap.className = "leaderboard-name-wrap";
        var name = document.createElement("span");
        name.className = "leaderboard-name";
        name.textContent = entry.name;
        nameWrap.appendChild(name);

        if (entry.adjustment !== 0) {
          var adjNote = document.createElement("span");
          adjNote.className = "leaderboard-adj-note";
          adjNote.textContent = "TM adj: " + (entry.adjustment > 0 ? "+" : "") + entry.adjustment;
          nameWrap.appendChild(adjNote);
        }

        var pointsWrap = document.createElement("div");
        pointsWrap.className = "leaderboard-points-wrap";
        var points = document.createElement("span");
        points.className = "leaderboard-points";
        points.textContent = entry.total + " pts";
        pointsWrap.appendChild(points);

        var tmControls = document.createElement("div");
        tmControls.className = "tm-adjust-controls";
        tmControls.setAttribute("aria-label", "Taskmaster point adjustment for " + entry.name);

        var minusBtn = document.createElement("button");
        minusBtn.type = "button";
        minusBtn.className = "tm-adjust-btn";
        minusBtn.textContent = "−";
        minusBtn.setAttribute("aria-label", "Remove 1 point from " + entry.name);
        minusBtn.addEventListener("click", function () {
          state.adjustments[entry.index] = (state.adjustments[entry.index] || 0) - 1;
          saveState(state);
          renderLeaderboard();
        });

        var adjDisplay = document.createElement("span");
        adjDisplay.className = "tm-adjust-value";
        var adjVal = state.adjustments[entry.index] || 0;
        adjDisplay.textContent = adjVal > 0 ? "+" + adjVal : String(adjVal);

        var plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "tm-adjust-btn";
        plusBtn.textContent = "+";
        plusBtn.setAttribute("aria-label", "Add 1 point to " + entry.name);
        plusBtn.addEventListener("click", function () {
          state.adjustments[entry.index] = (state.adjustments[entry.index] || 0) + 1;
          saveState(state);
          renderLeaderboard();
        });

        tmControls.appendChild(minusBtn);
        tmControls.appendChild(adjDisplay);
        tmControls.appendChild(plusBtn);
        pointsWrap.appendChild(tmControls);

        var barWrap = document.createElement("div");
        barWrap.className = "leaderboard-bar-wrap";
        var bar = document.createElement("div");
        bar.className = "leaderboard-bar";
        barWrap.appendChild(bar);

        li.appendChild(rank);
        li.appendChild(nameWrap);
        li.appendChild(pointsWrap);
        li.appendChild(barWrap);
        leaderboardList.appendChild(li);

        requestAnimationFrame(function () {
          bar.style.width = Math.round((entry.total / maxScore) * 100) + "%";
        });
      });

      showView(leaderboardEl);
    }

    function renderPodium() {
      var entries = getLeaderboardEntries();
      if (!entries.length) return;

      var topScore = entries[0].total;
      var winners = entries.filter(function (entry) {
        return entry.total === topScore;
      });
      var winnerLabel = winners.map(function (w) { return w.name; }).join(" & ");

      if (podiumWinnerName) podiumWinnerName.textContent = winnerLabel;
      if (podiumWinnerSub) {
        podiumWinnerSub.textContent = winners.length > 1
          ? "Joint winners with " + topScore + " points!"
          : "Champion with " + topScore + " points!";
      }

      if (podiumMiniTableBody) {
        podiumMiniTableBody.innerHTML = "";
        entries.forEach(function (entry, position) {
          var tr = document.createElement("tr");
          if (position === 0) tr.className = "podium-mini-table-row--winner";

          var rankTd = document.createElement("td");
          rankTd.className = "podium-mini-rank";
          rankTd.textContent = getPodiumRankLabel(position);

          var nameTd = document.createElement("td");
          nameTd.className = "podium-mini-name";
          nameTd.textContent = entry.name;

          var ptsTd = document.createElement("td");
          ptsTd.className = "podium-mini-pts";
          ptsTd.textContent = String(entry.total);

          tr.appendChild(rankTd);
          tr.appendChild(nameTd);
          tr.appendChild(ptsTd);
          podiumMiniTableBody.appendChild(tr);
        });
      }

      if (podiumEl) showView(podiumEl);
    }

    function hideResetConfirm() {
      if (!resetConfirmModal) return;
      resetConfirmModal.classList.remove("visible");
      resetConfirmModal.setAttribute("aria-hidden", "true");
      if (resetConfirmLastFocused && resetConfirmLastFocused.focus) {
        resetConfirmLastFocused.focus();
      }
      resetConfirmLastFocused = null;
    }

    function showResetConfirm() {
      if (!resetConfirmModal) return;
      resetConfirmLastFocused = document.activeElement;
      resetConfirmModal.classList.add("visible");
      resetConfirmModal.setAttribute("aria-hidden", "false");
      if (resetConfirmCancelBtn) resetConfirmCancelBtn.focus();
    }

    function resetEverything() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROGRESS_KEY);
      state = {
        names: [],
        scores: [],
        adjustments: [],
        currentRound: 0,
        started: false,
        setupSlotCount: INITIAL_SETUP_SLOTS
      };
      rebuildSetupGrid();
      showView(setupEl);
    }

    rebuildSetupGrid();
    ensureAdjustments();

    if (state.started && getActiveNames().length >= 2) {
      showView(scoringEl);
      renderScoring();
    } else {
      showView(setupEl);
    }

    if (startBtn) startBtn.addEventListener("click", startGames);
    if (addContestantBtn) addContestantBtn.addEventListener("click", addContestantSlot);
    if (viewLeaderboardBtn) viewLeaderboardBtn.addEventListener("click", renderLeaderboard);
    if (winnersPodiumBtn) winnersPodiumBtn.addEventListener("click", renderPodium);
    if (podiumBackBtn) {
      podiumBackBtn.addEventListener("click", function () {
        renderLeaderboard();
      });
    }
    if (backToScoringBtn) {
      backToScoringBtn.addEventListener("click", function () {
        showView(scoringEl);
        renderScoring();
      });
    }
    if (resetBtn) resetBtn.addEventListener("click", showResetConfirm);
    if (resetConfirmCancelBtn) resetConfirmCancelBtn.addEventListener("click", hideResetConfirm);
    if (resetConfirmYesBtn) {
      resetConfirmYesBtn.addEventListener("click", function () {
        hideResetConfirm();
        resetEverything();
      });
    }
    if (resetConfirmModal) {
      resetConfirmModal.addEventListener("click", function (event) {
        if (event.target === resetConfirmModal) hideResetConfirm();
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && resetConfirmModal && resetConfirmModal.classList.contains("visible")) {
        hideResetConfirm();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initEnvelopes();
    initScoreboard();
  });
})();
