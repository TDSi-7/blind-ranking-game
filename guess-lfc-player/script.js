(function () {
    'use strict';

    var GAME_ID = 'guess-lfc-player';
    var WRONG_PENALTIES = [5, 4, 3, 2, 1];
    var CLUES = [
        { key: 'club', label: 'Club', cost: 25, format: function (p) { return String(p.club || '—'); } },
        { key: 'debutYear', label: 'Year of Debut', cost: 5, format: function (p) { return String(p.debutYear || '—'); } },
        { key: 'nationality', label: 'Nationality', cost: 12, format: function (p) { return String(p.nationality || '—'); } },
        { key: 'shirtNumber', label: 'Shirt Number', cost: 10, format: function (p) { return String(p.shirtNumber != null ? p.shirtNumber : '—'); } },
        { key: 'boughtFrom', label: 'Bought from', cost: 5, format: function (p) { return String(p.boughtFrom || '—'); } },
        { key: 'feePaid', label: 'Fee Paid', cost: 5, format: function (p) { return String(p.feePaid || '—'); } },
        { key: 'soldTo', label: 'Sold to', cost: 3, format: function (p) { return String(p.soldTo || '—'); } },
        { key: 'feeReceived', label: 'Fee Received', cost: 2, format: function (p) { return String(p.feeReceived || '—'); } },
        { key: 'gamesPlayed', label: 'Games played', cost: 6, format: function (p) { return String(p.gamesPlayed != null ? p.gamesPlayed : '—'); } },
        { key: 'goals', label: 'Goals', cost: 5, format: function (p) { return String(p.goals != null ? p.goals : '—'); } },
        { key: 'assists', label: 'Assists', cost: 2, format: function (p) { return String(p.assists != null ? p.assists : '—'); } },
        { key: 'appearances', label: 'Appearances', cost: 5, format: function (p) { return String(p.appearances != null ? p.appearances : '—'); } }
    ];

    function stripDiacritics(s) {
        return s.normalize('NFD').replace(/\p{M}/gu, '');
    }

    var MAX_NAME_SUGGESTIONS = 12;

    function normalizeName(s) {
        return stripDiacritics(String(s || '').toLowerCase().trim()).replace(/\s+/g, ' ');
    }

    /**
     * Name autocomplete: one letter matches any word start (first or surname).
     * Two letters match only the first word (so "Ma" keeps Mohamed…, drops Sadio Mane).
     * Three+ letters match first word or last word prefix (so "Sal" can match … Salah).
     */
    function playerMatchesNameFilter(player, query) {
        var q = normalizeName(query);
        if (!q) return false;
        var tokens = normalizeName(player.name).split(/\s+/).filter(Boolean);
        if (!tokens.length) return false;
        var i;
        if (q.length === 1) {
            for (i = 0; i < tokens.length; i++) {
                if (tokens[i].indexOf(q) === 0) return true;
            }
            return false;
        }
        if (q.length === 2) {
            return tokens[0].indexOf(q) === 0;
        }
        if (tokens[0].indexOf(q) === 0) return true;
        if (tokens.length >= 2 && tokens[tokens.length - 1].indexOf(q) === 0) return true;
        return false;
    }

    function getNameSuggestions(players, query) {
        var out = [];
        var i;
        for (i = 0; i < players.length; i++) {
            if (playerMatchesNameFilter(players[i], query)) out.push(players[i]);
        }
        out.sort(function (a, b) {
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        if (out.length > MAX_NAME_SUGGESTIONS) out = out.slice(0, MAX_NAME_SUGGESTIONS);
        return out;
    }

    function levenshtein(a, b) {
        var m = a.length;
        var n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        var i;
        var j;
        var prev = new Array(n + 1);
        var cur = new Array(n + 1);
        for (j = 0; j <= n; j++) prev[j] = j;
        for (i = 1; i <= m; i++) {
            cur[0] = i;
            for (j = 1; j <= n; j++) {
                var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            }
            var t = prev;
            prev = cur;
            cur = t;
        }
        return prev[n];
    }

    function fuzzyThreshold(len) {
        if (len <= 4) return 0;
        if (len <= 12) return 1;
        return 2;
    }

    function lastToken(normalizedFullName) {
        var parts = normalizedFullName.split(/\s+/).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : '';
    }

    function countPlayersWithLastToken(token, allPlayers) {
        var n = 0;
        for (var i = 0; i < allPlayers.length; i++) {
            if (lastToken(normalizeName(allPlayers[i].name)) === token) n++;
        }
        return n;
    }

    function guessMatchesPlayer(guessRaw, player, allPlayers) {
        var g = normalizeName(guessRaw);
        if (!g) return false;
        var full = normalizeName(player.name);
        if (g === full) return true;

        if (g.indexOf(' ') === -1 && g.length > 0) {
            var tok = g;
            if (countPlayersWithLastToken(tok, allPlayers) === 1 && lastToken(full) === tok) {
                return true;
            }
        }

        var th = fuzzyThreshold(full.length);
        if (levenshtein(g, full) <= th) return true;

        var parts = full.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            var firstLast = parts[0] + ' ' + parts[parts.length - 1];
            if (levenshtein(g, firstLast) <= fuzzyThreshold(firstLast.length)) return true;
        }

        var gp = g.split(/\s+/).filter(Boolean);
        if (gp.length >= 2 && parts.length >= 2) {
            var tFirst = fuzzyThreshold(parts[0].length);
            var tLast = fuzzyThreshold(parts[parts.length - 1].length);
            if (
                levenshtein(gp[0], parts[0]) <= tFirst &&
                levenshtein(gp[gp.length - 1], parts[parts.length - 1]) <= tLast
            ) {
                return true;
            }
        }

        return false;
    }

    function positionCategory(raw) {
        var p = String(raw || '').toUpperCase().trim();
        if (!p) return 'Unknown';
        if (p === 'GK' || p.indexOf('GOAL') >= 0) return 'Goalkeeper';
        if (
            p === 'CB' ||
            p === 'LB' ||
            p === 'RB' ||
            p === 'LWB' ||
            p === 'RWB' ||
            p === 'DEF' ||
            p.indexOf('BACK') >= 0 ||
            p.indexOf('DEFEND') >= 0
        ) {
            return 'Defender';
        }
        if (
            p === 'DM' ||
            p === 'CM' ||
            p === 'AM' ||
            p === 'CAM' ||
            p === 'LM' ||
            p === 'RM' ||
            p === 'MID' ||
            p.indexOf('MID') >= 0
        ) {
            return 'Midfielder';
        }
        if (
            p === 'LW' ||
            p === 'RW' ||
            p === 'ST' ||
            p === 'CF' ||
            p === 'FW' ||
            p === 'ATT' ||
            p.indexOf('FORWARD') >= 0 ||
            p.indexOf('WING') >= 0
        ) {
            return 'Forward';
        }
        return raw;
    }

    function clampScore(n) {
        return Math.max(0, n);
    }

    function spendPoints(current, cost) {
        return clampScore(current - Math.max(0, cost || 0));
    }

    function loadBestScore() {
        var Hub = window.FunGamesHubProfiles;
        if (Hub) {
            var pid = Hub.getCurrentProfileId();
            if (pid) {
                var data = Hub.getStatsForGame(pid, GAME_ID);
                if (data && typeof data.highScore === 'number') return data.highScore;
            }
        }
        try {
            var raw = localStorage.getItem('guessLfcPlayerBestScore');
            if (raw) {
                var n = parseInt(raw, 10);
                if (Number.isFinite(n)) return n;
            }
        } catch (e) {}
        return 0;
    }

    function recordRoundEnd(finalScore) {
        var Hub = window.FunGamesHubProfiles;
        if (Hub) {
            var pid = Hub.getCurrentProfileId();
            if (pid) {
                var prev = Hub.getStatsForGame(pid, GAME_ID) || {};
                var high = typeof prev.highScore === 'number' ? prev.highScore : 0;
                var next = {
                    gamesPlayed: (prev.gamesPlayed || 0) + 1,
                    lastScore: finalScore
                };
                if (finalScore > high) next.highScore = finalScore;
                Hub.setStatsForGame(pid, GAME_ID, next);
                return;
            }
        }
        try {
            var cur = parseInt(localStorage.getItem('guessLfcPlayerBestScore'), 10) || 0;
            if (finalScore > cur) localStorage.setItem('guessLfcPlayerBestScore', String(finalScore));
        } catch (e) {}
    }

    function Game() {
        this.players = [];
        this.secret = null;
        this.score = 100;
        this.wrongGuesses = 0;
        this.revealed = {};
        this.ended = false;

        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.startBtn = document.getElementById('startBtn');
        this.bestScoreStart = document.getElementById('bestScoreStart');
        this.scoreDisplay = document.getElementById('scoreDisplay');
        this.guessesLeftDisplay = document.getElementById('guessesLeftDisplay');
        this.positionDisplay = document.getElementById('positionDisplay');
        this.guessForm = document.getElementById('guessForm');
        this.guessInput = document.getElementById('guessInput');
        this.guessSuggestions = document.getElementById('guessSuggestions');
        this.acIndex = -1;
        this.guessFeedback = document.getElementById('guessFeedback');
        this.guessSubmitBtn = document.getElementById('guessSubmitBtn');
        this.clueGrid = document.getElementById('clueGrid');
        this.newRoundBtn = document.getElementById('newRoundBtn');
        this.endModal = document.getElementById('endModal');
        this.endModalTitle = document.getElementById('endModalTitle');
        this.endModalBody = document.getElementById('endModalBody');
        this.endPlayAgainBtn = document.getElementById('endPlayAgainBtn');
    }

    Game.prototype.init = function () {
        var self = this;
        this.refreshBestDisplay();
        this.startBtn.addEventListener('click', function () { self.startRound(); });
        this.guessForm.addEventListener('submit', function (e) {
            e.preventDefault();
            self.submitGuess();
        });
        this.newRoundBtn.addEventListener('click', function () { self.startRound(); });
        this.endPlayAgainBtn.addEventListener('click', function () {
            self.endModal.style.display = 'none';
            self.startRound();
        });
        this.guessInput.addEventListener('input', function () {
            self.onGuessInput();
        });
        this.guessInput.addEventListener('keydown', function (e) {
            self.onGuessKeydown(e);
        });
        this.guessInput.addEventListener('blur', function () {
            setTimeout(function () {
                self.hideSuggestions();
            }, 180);
        });
        this.loadData();
    };

    Game.prototype.onGuessInput = function () {
        if (this.ended) return;
        this.updateNameSuggestions();
    };

    Game.prototype.updateNameSuggestions = function () {
        if (!this.guessSuggestions || this.ended) return;
        var q = this.guessInput.value;
        if (!q.trim()) {
            this.hideSuggestions();
            return;
        }
        var list = getNameSuggestions(this.players, q);
        if (!list.length) {
            this.hideSuggestions();
            return;
        }
        this.guessSuggestions.innerHTML = '';
        var self = this;
        for (var i = 0; i < list.length; i++) {
            (function (player) {
                var li = document.createElement('li');
                li.setAttribute('role', 'option');
                li.className = 'guess-suggestion';
                li.textContent = player.name;
                li.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    self.guessInput.value = player.name;
                    self.hideSuggestions();
                    self.guessInput.focus();
                });
                self.guessSuggestions.appendChild(li);
            })(list[i]);
        }
        this.guessSuggestions.hidden = false;
        this.guessInput.setAttribute('aria-expanded', 'true');
        this.acIndex = 0;
        this.syncAcHighlight();
    };

    Game.prototype.hideSuggestions = function () {
        if (!this.guessSuggestions) return;
        this.guessSuggestions.hidden = true;
        this.guessSuggestions.innerHTML = '';
        this.acIndex = -1;
        this.guessInput.setAttribute('aria-expanded', 'false');
    };

    Game.prototype.syncAcHighlight = function () {
        var items = this.guessSuggestions.querySelectorAll('.guess-suggestion');
        var i;
        for (i = 0; i < items.length; i++) {
            items[i].classList.toggle('guess-suggestion--active', i === this.acIndex);
        }
    };

    Game.prototype.onGuessKeydown = function (e) {
        if (this.ended) return;
        var open = this.guessSuggestions && !this.guessSuggestions.hidden;
        var items = open ? this.guessSuggestions.querySelectorAll('.guess-suggestion') : [];

        if (e.key === 'ArrowDown' && open && items.length) {
            e.preventDefault();
            this.acIndex = (this.acIndex + 1) % items.length;
            this.syncAcHighlight();
            return;
        }
        if (e.key === 'ArrowUp' && open && items.length) {
            e.preventDefault();
            this.acIndex = this.acIndex <= 0 ? items.length - 1 : this.acIndex - 1;
            this.syncAcHighlight();
            return;
        }
        if (e.key === 'Escape' && open) {
            e.preventDefault();
            this.hideSuggestions();
            return;
        }
        if (e.key === 'Enter' && open && items.length && this.acIndex >= 0) {
            e.preventDefault();
            var pick = items[this.acIndex];
            if (pick) {
                this.guessInput.value = pick.textContent;
                this.hideSuggestions();
            }
            return;
        }
    };

    Game.prototype.refreshBestDisplay = function () {
        var b = loadBestScore();
        if (this.bestScoreStart) this.bestScoreStart.textContent = b > 0 ? String(b) : '—';
    };

    Game.prototype.loadData = function () {
        var self = this;
        fetch('data/players.json?v=20260415a')
            .then(function (r) {
                if (!r.ok) throw new Error('load failed');
                return r.json();
            })
            .then(function (data) {
                self.players = data.players || [];
                if (!self.players.length) {
                    self.guessFeedback.textContent = 'No player data.';
                }
            })
            .catch(function () {
                self.guessFeedback.textContent = 'Could not load players.';
            });
    };

    Game.prototype.pickSecret = function () {
        var n = this.players.length;
        if (!n) return null;
        var i = Math.floor(Math.random() * n);
        return this.players[i];
    };

    Game.prototype.startRound = function () {
        if (!this.players.length) {
            alert('Player data is still loading or empty.');
            return;
        }
        this.secret = this.pickSecret();
        this.score = 100;
        this.wrongGuesses = 0;
        this.revealed = {};
        this.ended = false;

        this.startScreen.classList.remove('active');
        this.gameScreen.classList.add('active');
        this.positionDisplay.textContent = positionCategory(this.secret.position);
        this.guessInput.value = '';
        this.hideSuggestions();
        this.guessFeedback.textContent = '';
        this.guessInput.disabled = false;
        this.guessSubmitBtn.disabled = false;
        this.updateHud();
        this.renderClues();
        this.guessInput.focus();
    };

    Game.prototype.updateHud = function () {
        this.scoreDisplay.textContent = String(clampScore(this.score));
        var left = Math.max(0, 5 - this.wrongGuesses);
        this.guessesLeftDisplay.textContent = String(left);
    };

    Game.prototype.renderClues = function () {
        var self = this;
        this.clueGrid.innerHTML = '';
        CLUES.forEach(function (c) {
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'clue-card';
            card.setAttribute('data-key', c.key);

            var revealed = !!self.revealed[c.key];
            var canAfford = self.score >= c.cost && !self.ended;

            if (revealed) {
                card.classList.add('clue-card--revealed');
                card.disabled = true;
                card.innerHTML =
                    '<span class="clue-card__label">' +
                    escapeHtml(c.label) +
                    '</span>' +
                    '<span class="clue-card__value">' +
                    escapeHtml(c.format(self.secret)) +
                    '</span>';
            } else {
                card.classList.add('clue-card--face-down');
                if (!canAfford || self.ended) card.classList.add('clue-card--disabled');
                card.disabled = !canAfford || self.ended;
                card.innerHTML =
                    '<span class="clue-card__front-title">' +
                    escapeHtml(c.label) +
                    '</span>' +
                    '<span class="clue-card__cost">' +
                    escapeHtml(String(c.cost)) +
                    ' pts</span>';
                card.addEventListener('click', function () {
                    self.buyClue(c.key);
                });
            }
            self.clueGrid.appendChild(card);
        });
    };

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    Game.prototype.buyClue = function (key) {
        if (this.ended) return;
        var c = null;
        for (var ci = 0; ci < CLUES.length; ci++) {
            if (CLUES[ci].key === key) {
                c = CLUES[ci];
                break;
            }
        }
        if (!c || this.revealed[key]) return;
        if (this.score < c.cost) return;
        this.score = spendPoints(this.score, c.cost);
        this.revealed[key] = true;
        this.updateHud();
        this.renderClues();
    };

    Game.prototype.submitGuess = function () {
        if (this.ended || !this.secret) return;
        var text = this.guessInput.value;
        if (!text.trim()) {
            this.guessFeedback.textContent = 'Enter a name.';
            return;
        }

        this.hideSuggestions();

        if (guessMatchesPlayer(text, this.secret, this.players)) {
            var finalScore = clampScore(this.score);
            recordRoundEnd(finalScore);
            this.refreshBestDisplay();
            this.ended = true;
            this.guessInput.disabled = true;
            this.guessSubmitBtn.disabled = true;
            this.renderClues();
            this.showEnd(true, finalScore);
            return;
        }

        if (this.wrongGuesses >= 5) return;

        var penalty = WRONG_PENALTIES[this.wrongGuesses];
        this.score = spendPoints(this.score, penalty);
        this.wrongGuesses++;
        this.guessFeedback.textContent = 'Not quite — that cost ' + penalty + ' points.';
        this.updateHud();
        this.renderClues();

        if (this.wrongGuesses >= 5) {
            this.ended = true;
            this.guessInput.disabled = true;
            this.guessSubmitBtn.disabled = true;
            recordRoundEnd(clampScore(this.score));
            this.refreshBestDisplay();
            this.showEnd(false, clampScore(this.score));
        }
    };

    Game.prototype.showEnd = function (won, finalScore) {
        this.endModal.style.display = 'flex';
        if (won) {
            this.endModalTitle.textContent = 'Correct!';
            this.endModalBody.textContent =
                'The player was ' +
                this.secret.name +
                '. You finish with ' +
                finalScore +
                ' points.';
        } else {
            this.endModalTitle.textContent = 'Out of guesses';
            this.endModalBody.textContent =
                'The player was ' + this.secret.name + '. Better luck next time!';
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var g = new Game();
        g.init();
    });
})();
