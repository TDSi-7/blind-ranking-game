(function () {
    'use strict';

    var LS_KEY = 'jones-higher-or-lower-best-streaks';
    var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663']; /* spade heart diamond club */

    var DIFFICULTY = {
        easy: { label: 'Easy', count: 5 },
        medium: { label: 'Medium', count: 7 },
        hard: { label: 'Hard', count: 10 }
    };

    function isRedSuit(suit) {
        return suit === '\u2665' || suit === '\u2666';
    }

    function suitAria(suit) {
        return suit === '\u2660' ? 'spades' : suit === '\u2665' ? 'hearts' : suit === '\u2666' ? 'diamonds' : 'clubs';
    }

    function buildDeck() {
        var deck = [];
        var s, r;
        for (s = 0; s < SUITS.length; s++) {
            for (r = 0; r < RANKS.length; r++) {
                deck.push({
                    suit: SUITS[s],
                    rank: RANKS[r],
                    value: r + 1
                });
            }
        }
        return deck;
    }

    function shuffle(arr) {
        var i, j, t;
        for (i = arr.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }

    function getBestStreaks() {
        try {
            var raw = localStorage.getItem(LS_KEY);
            if (!raw) return { easy: 0, medium: 0, hard: 0 };
            var o = JSON.parse(raw);
            return {
                easy: Number(o.easy) || 0,
                medium: Number(o.medium) || 0,
                hard: Number(o.hard) || 0
            };
        } catch (e) {
            return { easy: 0, medium: 0, hard: 0 };
        }
    }

    function setBestIfBetter(difficultyKey, streak) {
        var best = getBestStreaks();
        var cur = best[difficultyKey] || 0;
        if (streak > cur) {
            best[difficultyKey] = streak;
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(best));
            } catch (e) { /* ignore */ }
        }
        return best[difficultyKey];
    }

    function renderCardFace(el, card, extraClass) {
        el.innerHTML = '';
        el.className = 'card' + (extraClass ? ' ' + extraClass : '');
        if (isRedSuit(card.suit)) el.classList.add('card--red');
        var rank = document.createElement('span');
        rank.className = 'card__rank';
        rank.textContent = card.rank;
        var suit = document.createElement('span');
        suit.className = 'card__suit';
        suit.textContent = card.suit;
        suit.setAttribute('aria-hidden', 'true');
        el.appendChild(rank);
        el.appendChild(suit);
        el.setAttribute('aria-label', card.rank + ' of ' + suitAria(card.suit));
    }

    function renderSmallCard(el, card) {
        renderCardFace(el, card, 'card--slot');
    }

    function renderCardBack(el, slotIndex) {
        el.innerHTML = '';
        el.className = 'card card--back card--slot';
        el.setAttribute('aria-label', 'Hidden card ' + (slotIndex + 1));
    }

    function HolGame() {
        this.difficultyKey = null;
        this.row = [];
        this.chain = [];
        this.nextIdx = 0;
        this.streak = 0;
        this.gameState = 'idle';
        this.resolving = false;
        this.showLosingCard = false;
        this.lossTimeoutId = null;

        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.startBtn = document.getElementById('startBtn');
        this.difficultyLabel = document.getElementById('difficultyLabel');
        this.streakLabel = document.getElementById('streakLabel');
        this.statusMessage = document.getElementById('statusMessage');
        this.chainCards = document.getElementById('chainCards');
        this.tableRow = document.getElementById('tableRow');
        this.higherBtn = document.getElementById('higherBtn');
        this.lowerBtn = document.getElementById('lowerBtn');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.changeDifficultyBtn = document.getElementById('changeDifficultyBtn');
        this.gameOverModal = document.getElementById('gameOverModal');
        this.gameOverTitle = document.getElementById('gameOverTitle');
        this.gameOverBody = document.getElementById('gameOverBody');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        this.modalChangeDifficultyBtn = document.getElementById('modalChangeDifficultyBtn');
    }

    HolGame.prototype.getConfig = function () {
        return this.difficultyKey ? DIFFICULTY[this.difficultyKey] : null;
    };

    HolGame.prototype.getCurrent = function () {
        if (!this.chain.length) return null;
        return this.chain[this.chain.length - 1];
    };

    HolGame.prototype.showScreen = function (name) {
        this.startScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        if (name === 'start') this.startScreen.classList.add('active');
        if (name === 'game') this.gameScreen.classList.add('active');
    };

    HolGame.prototype.refreshBestStreaksUI = function () {
        var b = getBestStreaks();
        var elE = document.getElementById('bestEasy');
        var elM = document.getElementById('bestMedium');
        var elH = document.getElementById('bestHard');
        if (elE) elE.textContent = String(b.easy);
        if (elM) elM.textContent = String(b.medium);
        if (elH) elH.textContent = String(b.hard);
    };

    HolGame.prototype.hideModal = function () {
        if (this.gameOverModal) this.gameOverModal.style.display = 'none';
    };

    HolGame.prototype.showModalEnd = function (won, streak) {
        var cfg = this.getConfig();
        if (!this.gameOverModal || !cfg) return;
        setBestIfBetter(this.difficultyKey, streak);
        this.refreshBestStreaksUI();
        var bestAfter = getBestStreaks()[this.difficultyKey] || 0;
        this.gameOverTitle.textContent = won ? 'You cleared the row!' : 'Game over';
        if (won) {
            this.gameOverBody.textContent =
                'You guessed every card correctly. Correct guesses this run: ' +
                streak +
                '. Best for ' +
                cfg.label +
                ': ' +
                bestAfter +
                '.';
        } else {
            this.gameOverBody.textContent =
                'Correct guesses this run: ' +
                streak +
                '. Best for ' +
                cfg.label +
                ': ' +
                bestAfter +
                '.';
        }
        this.gameOverModal.style.display = 'flex';
    };

    HolGame.prototype.setGuessButtons = function (enabled) {
        this.higherBtn.disabled = !enabled;
        this.lowerBtn.disabled = !enabled;
    };

    HolGame.prototype.updateStreakLabel = function () {
        this.streakLabel.textContent = 'Streak: ' + this.streak;
    };

    HolGame.prototype.renderChain = function () {
        var i;
        this.chainCards.innerHTML = '';
        for (i = 0; i < this.chain.length; i++) {
            var wrap = document.createElement('div');
            renderCardFace(wrap, this.chain[i], 'card--chain');
            this.chainCards.appendChild(wrap);
        }
    };

    HolGame.prototype.renderTable = function () {
        var i;
        this.tableRow.innerHTML = '';
        for (i = 0; i < this.row.length; i++) {
            var wrap = document.createElement('div');
            if (i < this.nextIdx) {
                renderSmallCard(wrap, this.row[i]);
            } else if (this.showLosingCard && i === this.nextIdx) {
                renderSmallCard(wrap, this.row[i]);
                var inner = wrap.querySelector('.card');
                if (inner) inner.classList.add('card--wrong-reveal');
            } else {
                renderCardBack(wrap, i);
            }
            this.tableRow.appendChild(wrap);
        }
    };

    HolGame.prototype.startRound = function () {
        var cfg = this.getConfig();
        if (!cfg) return;
        if (this.lossTimeoutId) {
            clearTimeout(this.lossTimeoutId);
            this.lossTimeoutId = null;
        }
        this.hideModal();
        var deck = shuffle(buildDeck());
        var n = cfg.count;
        this.row = deck.slice(0, n);
        this.chain = [deck[n]];
        this.nextIdx = 0;
        this.streak = 0;
        this.resolving = false;
        this.showLosingCard = false;
        this.gameState = 'playing';
        this.difficultyLabel.textContent = cfg.label + ' · ' + n + ' cards';
        this.updateStreakLabel();
        this.statusMessage.textContent = '';
        this.renderChain();
        this.renderTable();
        this.setGuessButtons(false);
        this.showScreen('game');
        this.beginTurn();
    };

    HolGame.prototype.checkWin = function () {
        if (this.nextIdx >= this.row.length) {
            this.gameState = 'ended';
            this.setGuessButtons(false);
            this.showModalEnd(true, this.streak);
            return true;
        }
        return false;
    };

    HolGame.prototype.beginTurn = function () {
        var self = this;
        if (this.gameState !== 'playing') return;
        if (this.checkWin()) return;

        var cur = this.getCurrent();
        var next = this.row[this.nextIdx];
        if (next.value === cur.value) {
            this.resolving = true;
            this.setGuessButtons(false);
            this.statusMessage.textContent = 'Same rank — the next card flips for free.';
            window.setTimeout(function () {
                if (self.gameState !== 'playing') return;
                self.chain.push(next);
                self.nextIdx += 1;
                self.resolving = false;
                self.renderChain();
                self.renderTable();
                self.statusMessage.textContent = '';
                if (self.checkWin()) return;
                self.beginTurn();
            }, 700);
            return;
        }

        this.statusMessage.textContent =
            'Is the next hidden card higher or lower than your ' + cur.rank + '?';
        this.setGuessButtons(true);
    };

    HolGame.prototype.onGuess = function (wantHigher) {
        if (this.gameState !== 'playing' || this.resolving) return;
        if (this.nextIdx >= this.row.length) return;

        var cur = this.getCurrent();
        var next = this.row[this.nextIdx];
        if (next.value === cur.value) {
            this.beginTurn();
            return;
        }

        this.setGuessButtons(false);

        var higherWins = next.value > cur.value;
        var correct = wantHigher ? higherWins : !higherWins;

        if (!correct) {
            this.gameState = 'loss_pending';
            this.showLosingCard = true;
            this.renderTable();
            this.statusMessage.textContent =
                'The next card was the ' + next.rank + ' of ' + suitAria(next.suit) + '.';
            var self = this;
            this.lossTimeoutId = window.setTimeout(function () {
                self.lossTimeoutId = null;
                self.gameState = 'ended';
                self.showModalEnd(false, self.streak);
            }, 2000);
            return;
        }

        this.streak += 1;
        this.updateStreakLabel();
        this.chain.push(next);
        this.nextIdx += 1;
        this.renderChain();
        this.renderTable();
        this.setGuessButtons(false);
        this.beginTurn();
    };

    HolGame.prototype.init = function () {
        var self = this;
        this.refreshBestStreaksUI();

        document.querySelectorAll('[data-difficulty]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('[data-difficulty]').forEach(function (b) {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
                self.difficultyKey = btn.getAttribute('data-difficulty');
                self.startBtn.disabled = false;
            });
        });

        this.startBtn.addEventListener('click', function () {
            self.startRound();
        });

        this.higherBtn.addEventListener('click', function () {
            self.onGuess(true);
        });
        this.lowerBtn.addEventListener('click', function () {
            self.onGuess(false);
        });

        this.newGameBtn.addEventListener('click', function () {
            self.startRound();
        });
        this.changeDifficultyBtn.addEventListener('click', function () {
            if (self.lossTimeoutId) {
                clearTimeout(self.lossTimeoutId);
                self.lossTimeoutId = null;
            }
            self.hideModal();
            self.gameState = 'idle';
            self.showScreen('start');
        });
        this.playAgainBtn.addEventListener('click', function () {
            self.startRound();
        });
        this.modalChangeDifficultyBtn.addEventListener('click', function () {
            if (self.lossTimeoutId) {
                clearTimeout(self.lossTimeoutId);
                self.lossTimeoutId = null;
            }
            self.hideModal();
            self.gameState = 'idle';
            self.showScreen('start');
        });
    };

    document.addEventListener('DOMContentLoaded', function () {
        var g = new HolGame();
        g.init();
    });
})();
