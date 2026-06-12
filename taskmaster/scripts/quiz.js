(function () {
  "use strict";

  var ORDER_KEY = "tds-quiz-order";
  var PHASE_KEY = "tds-quiz-phase";
  var INDEX_KEY = "tds-quiz-index";
  var questions = window.TDS_QUIZ_QUESTIONS || [];

  var slideEl = document.getElementById("quiz-slide");
  var progressEl = document.getElementById("quiz-progress");
  var phaseLabelEl = document.getElementById("quiz-phase-label");
  var backBtn = document.getElementById("quiz-back");
  var nextBtn = document.getElementById("quiz-next");
  var modeToggleBtn = document.getElementById("quiz-mode-toggle");

  var order = [];
  var phase = "questions";
  var index = 0;

  function shuffle(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function loadOrder() {
    try {
      var saved = sessionStorage.getItem(ORDER_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.length === questions.length) return parsed;
      }
    } catch (e) { /* ignore */ }
    var fresh = shuffle(questions.map(function (q) { return q.id; }));
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function loadSession() {
    if (/[?&]new=1/.test(window.location.search)) {
      sessionStorage.removeItem(ORDER_KEY);
      sessionStorage.removeItem(PHASE_KEY);
      sessionStorage.removeItem(INDEX_KEY);
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, "", "quiz.html");
      }
    }
    order = loadOrder();
    phase = sessionStorage.getItem(PHASE_KEY) || "questions";
    index = parseInt(sessionStorage.getItem(INDEX_KEY) || "0", 10);
    if (index < 0) index = 0;
    if (index >= order.length) index = order.length - 1;
  }

  function saveSession() {
    sessionStorage.setItem(PHASE_KEY, phase);
    sessionStorage.setItem(INDEX_KEY, String(index));
  }

  function getCurrentQuestion() {
    var id = order[index];
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === id) return questions[i];
    }
    return null;
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  function renderSlide() {
    var q = getCurrentQuestion();
    if (!q || !slideEl) return;

    var slideNumber = index + 1;
    var total = order.length;

    if (progressEl) {
      progressEl.textContent = (phase === "questions" ? "Question " : "Answer ") + slideNumber + " of " + total;
    }
    if (phaseLabelEl) {
      phaseLabelEl.textContent = phase === "questions" ? "Questions" : "Answers";
      phaseLabelEl.className = "quiz-phase-label" + (phase === "answers" ? " quiz-phase-label--answers" : "");
    }

    if (phase === "questions") {
      slideEl.innerHTML =
        '<article class="quiz-card">' +
          '<span class="quiz-category">' + escapeHtml(q.category) + '</span>' +
          '<p class="quiz-question-text">' + escapeHtml(q.question) + '</p>' +
        '</article>';
    } else {
      slideEl.innerHTML =
        '<article class="quiz-card quiz-card--answer">' +
          '<span class="quiz-category">' + escapeHtml(q.category) + '</span>' +
          '<p class="quiz-question-text">' + escapeHtml(q.question) + '</p>' +
          '<div class="quiz-answer-block">' +
            '<p class="quiz-answer-label">Answer</p>' +
            '<p class="quiz-answer-text">' + escapeHtml(q.answer) + '</p>' +
            '<p class="quiz-answer-info">' + escapeHtml(q.info) + '</p>' +
          '</div>' +
        '</article>';
    }

    if (backBtn) backBtn.disabled = index === 0;
    if (nextBtn) {
      if (phase === "questions" && index === total - 1) {
        nextBtn.textContent = "View Answers →";
      } else if (phase === "answers" && index === total - 1) {
        nextBtn.textContent = "End of Answers";
        nextBtn.disabled = true;
      } else {
        nextBtn.disabled = false;
        nextBtn.textContent = phase === "questions" ? "Next Question →" : "Next Answer →";
      }
    }
    if (modeToggleBtn) {
      modeToggleBtn.textContent = phase === "questions" ? "Skip to Answers" : "Back to Questions";
    }
  }

  function goNext() {
    if (phase === "questions" && index === order.length - 1) {
      phase = "answers";
      index = 0;
      saveSession();
      renderSlide();
      return;
    }
    if (index < order.length - 1) {
      index += 1;
      saveSession();
      renderSlide();
    }
  }

  function goBack() {
    if (index > 0) {
      index -= 1;
      saveSession();
      renderSlide();
    }
  }

  function toggleMode() {
    phase = phase === "questions" ? "answers" : "questions";
    index = 0;
    saveSession();
    renderSlide();
  }

  function newQuiz() {
    sessionStorage.removeItem(ORDER_KEY);
    sessionStorage.removeItem(PHASE_KEY);
    sessionStorage.removeItem(INDEX_KEY);
    loadSession();
    phase = "questions";
    index = 0;
    saveSession();
    renderSlide();
  }

  if (backBtn) backBtn.addEventListener("click", goBack);
  if (nextBtn) nextBtn.addEventListener("click", goNext);
  if (modeToggleBtn) modeToggleBtn.addEventListener("click", toggleMode);

  var newQuizBtn = document.getElementById("quiz-new");
  if (newQuizBtn) newQuizBtn.addEventListener("click", newQuiz);

  loadSession();
  renderSlide();
})();
