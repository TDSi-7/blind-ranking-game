(function () {
    'use strict';

    var MAX_ATTEMPTS = 7;

    var DIFFICULTY = {
        easy: {
            label: 'Easy',
            codeLength: 5,
            colors: ['Yellow', 'Orange', 'Red', 'Green', 'Purple']
        },
        medium: {
            label: 'Medium',
            codeLength: 7,
            colors: ['Yellow', 'Orange', 'Red', 'Green', 'Purple', 'Blue', 'Brown']
        },
        hard: {
            label: 'Hard',
            codeLength: 10,
            colors: ['Yellow', 'Orange', 'Red', 'Green', 'Purple', 'Blue', 'Brown', 'Pink', 'Grey', 'Black']
        }
    };

    var COLOR_HEX = {
        Yellow: '#FFD700',
        Orange: '#FF9800',
        Red: '#F44336',
        Green: '#4CAF50',
        Purple: '#9C27B0',
        Blue: '#2196F3',
        Brown: '#795548',
        Pink: '#E91E63',
        Grey: '#9E9E9E',
        Black: '#212121'
    };

    function randomInt(max) {
        return Math.floor(Math.random() * max);
    }

    function generateSecret(length, palette) {
        var out = [];
        var n = palette.length;
        for (var i = 0; i < length; i++) {
            out.push(palette[randomInt(n)]);
        }
        return out;
    }

    /**
     * Per-slot feedback: 'green' | 'orange' | 'empty'
     * Duplicate-safe Mastermind-style matching.
     */
    function computeFeedback(secret, guess) {
        var n = secret.length;
        var feedback = new Array(n);
        var i;
        for (i = 0; i < n; i++) {
            feedback[i] = 'empty';
        }

        var secretRemaining = [];
        var guessRemaining = [];

        for (i = 0; i < n; i++) {
            if (guess[i] === secret[i]) {
                feedback[i] = 'green';
            } else {
                secretRemaining.push(secret[i]);
                guessRemaining.push({ idx: i, color: guess[i] });
            }
        }

        var counts = {};
        for (i = 0; i < secretRemaining.length; i++) {
            var c = secretRemaining[i];
            counts[c] = (counts[c] || 0) + 1;
        }

        for (i = 0; i < guessRemaining.length; i++) {
            var g = guessRemaining[i];
            if ((counts[g.color] || 0) > 0) {
                feedback[g.idx] = 'orange';
                counts[g.color]--;
            }
        }

        return feedback;
    }

    function CodebreakerGame() {
        this.difficultyKey = null;
        this.secretCode = [];
        this.attempts = [];
        this.currentGuess = [];
        this.gameStatus = 'idle';
        this.boardEl = document.getElementById('board');
        this.paletteEl = document.getElementById('palette');
        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.startBtn = document.getElementById('startBtn');
        this.submitBtn = document.getElementById('submitBtn');
        this.backspaceBtn = document.getElementById('backspaceBtn');
        this.clearRowBtn = document.getElementById('clearRowBtn');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.changeDifficultyBtn = document.getElementById('changeDifficultyBtn');
        this.difficultyLabel = document.getElementById('difficultyLabel');
        this.attemptsLabel = document.getElementById('attemptsLabel');
        this.statusMessage = document.getElementById('statusMessage');
        this.gameOverModal = document.getElementById('gameOverModal');
        this.gameOverTitle = document.getElementById('gameOverTitle');
        this.gameOverBody = document.getElementById('gameOverBody');
        this.secretReveal = document.getElementById('secretReveal');
        this.playAgainBtn = document.getElementById('playAgainBtn');
    }

    CodebreakerGame.prototype.getConfig = function () {
        return this.difficultyKey ? DIFFICULTY[this.difficultyKey] : null;
    };

    CodebreakerGame.prototype.showScreen = function (name) {
        this.startScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        if (name === 'start') this.startScreen.classList.add('active');
        if (name === 'game') this.gameScreen.classList.add('active');
    };

    CodebreakerGame.prototype.init = function () {
        var self = this;
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
        this.submitBtn.addEventListener('click', function () {
            self.submitGuess();
        });
        this.backspaceBtn.addEventListener('click', function () {
            self.backspace();
        });
        this.clearRowBtn.addEventListener('click', function () {
            self.clearCurrentRow();
        });
        this.newGameBtn.addEventListener('click', function () {
            self.hideModal();
            self.startRound();
        });
        this.changeDifficultyBtn.addEventListener('click', function () {
            self.hideModal();
            self.gameStatus = 'idle';
            self.showScreen('start');
        });
        this.playAgainBtn.addEventListener('click', function () {
            self.hideModal();
            self.startRound();
        });
        if (this.gameOverModal) {
            var backdrop = this.gameOverModal.querySelector('.modal-backdrop');
            if (backdrop) backdrop.addEventListener('click', function () {
                /* keep modal until explicit action */
            });
        }
    };

    CodebreakerGame.prototype.hideModal = function () {
        if (this.gameOverModal) this.gameOverModal.style.display = 'none';
    };

    CodebreakerGame.prototype.showModal = function (won) {
        var cfg = this.getConfig();
        if (!this.gameOverModal || !cfg) return;
        this.gameOverTitle.textContent = won ? 'You cracked the code!' : 'Out of attempts';
        this.gameOverBody.textContent = won
            ? 'Nice work—you matched every color in the right order.'
            : 'The secret code was:';
        this.secretReveal.innerHTML = '';
        this.secretCode.forEach(function (name) {
            var d = document.createElement('div');
            d.className = 'slot';
            d.style.background = COLOR_HEX[name] || '#ccc';
            d.setAttribute('title', name);
            d.setAttribute('aria-label', name);
            if (name === 'Black' || name === 'Purple' || name === 'Brown') {
                d.style.borderColor = '#666';
            }
            this.secretReveal.appendChild(d);
        }, this);
        this.gameOverModal.style.display = 'flex';
    };

    CodebreakerGame.prototype.startRound = function () {
        var cfg = this.getConfig();
        if (!cfg) return;
        this.secretCode = generateSecret(cfg.codeLength, cfg.colors);
        this.attempts = [];
        this.currentGuess = [];
        this.gameStatus = 'playing';
        this.hideModal();
        this.difficultyLabel.textContent = cfg.label + ' · ' + cfg.codeLength + ' slots';
        this.updateAttemptsLabel();
        this.statusMessage.textContent = 'Fill the highlighted row and submit your guess.';
        this.buildPalette();
        this.renderBoard();
        this.updateControls();
        this.showScreen('game');
    };

    CodebreakerGame.prototype.updateAttemptsLabel = function () {
        var used = this.attempts.length;
        this.attemptsLabel.textContent = 'Attempts: ' + used + ' / ' + MAX_ATTEMPTS;
    };

    CodebreakerGame.prototype.buildPalette = function () {
        var cfg = this.getConfig();
        var self = this;
        this.paletteEl.innerHTML = '';
        cfg.colors.forEach(function (name) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'palette-btn';
            b.style.background = COLOR_HEX[name] || '#ccc';
            b.setAttribute('aria-label', name);
            b.setAttribute('title', name);
            if (name === 'Black' || name === 'Purple' || name === 'Brown') {
                b.style.borderColor = '#444';
            }
            b.addEventListener('click', function () {
                self.addColor(name);
            });
            self.paletteEl.appendChild(b);
        });
    };

    CodebreakerGame.prototype.getActiveRowIndex = function () {
        return this.attempts.length;
    };

    CodebreakerGame.prototype.addColor = function (name) {
        if (this.gameStatus !== 'playing') return;
        var cfg = this.getConfig();
        if (cfg.colors.indexOf(name) < 0) return;
        if (this.currentGuess.length >= cfg.codeLength) return;
        this.currentGuess.push(name);
        this.renderBoard();
        this.updateControls();
    };

    CodebreakerGame.prototype.backspace = function () {
        if (this.gameStatus !== 'playing') return;
        this.currentGuess.pop();
        this.renderBoard();
        this.updateControls();
    };

    CodebreakerGame.prototype.clearCurrentRow = function () {
        if (this.gameStatus !== 'playing') return;
        this.currentGuess = [];
        this.renderBoard();
        this.updateControls();
    };

    CodebreakerGame.prototype.updateControls = function () {
        var cfg = this.getConfig();
        var full = cfg && this.currentGuess.length === cfg.codeLength;
        var playing = this.gameStatus === 'playing';
        this.submitBtn.disabled = !playing || !full;
        this.backspaceBtn.disabled = !playing || this.currentGuess.length === 0;
        this.clearRowBtn.disabled = !playing || this.currentGuess.length === 0;
        if (this.paletteEl) {
            var buttons = this.paletteEl.querySelectorAll('.palette-btn');
            buttons.forEach(function (btn) {
                btn.disabled = !playing;
            });
        }
    };

    CodebreakerGame.prototype.renderBoard = function () {
        var cfg = this.getConfig();
        if (!cfg) return;
        this.boardEl.setAttribute('data-slots', String(cfg.codeLength));
        this.boardEl.innerHTML = '';
        var row;

        for (row = 0; row < MAX_ATTEMPTS; row++) {
            var rowEl = document.createElement('div');
            var isLocked = row < this.attempts.length;
            var isActive = !isLocked && row === this.getActiveRowIndex() && this.gameStatus === 'playing';
            rowEl.className = 'board-row';
            if (isLocked) rowEl.classList.add('locked');
            if (isActive) rowEl.classList.add('active');

            var slotsWrap = document.createElement('div');
            slotsWrap.className = 'slots';

            var guess;
            var feedback;
            if (isLocked) {
                guess = this.attempts[row].guess;
                feedback = this.attempts[row].feedback;
            } else if (isActive) {
                guess = this.currentGuess;
                feedback = null;
            } else {
                guess = [];
                feedback = null;
            }

            var col;
            for (col = 0; col < cfg.codeLength; col++) {
                var slot = document.createElement('div');
                slot.className = 'slot';
                if (!isLocked && !isActive) {
                    slot.classList.add('empty');
                } else if (col < guess.length) {
                    var colorName = guess[col];
                    slot.style.background = COLOR_HEX[colorName] || '#ccc';
                    slot.setAttribute('title', colorName);
                    if (colorName === 'Black' || colorName === 'Purple' || colorName === 'Brown') {
                        slot.style.borderColor = '#444';
                    }
                } else {
                    slot.classList.add('empty');
                }
                slotsWrap.appendChild(slot);
            }

            var feedbackCol = document.createElement('div');
            feedbackCol.className = 'feedback-dots';
            if (feedback) {
                var fr = document.createElement('div');
                fr.className = 'feedback-row';
                for (col = 0; col < feedback.length; col++) {
                    var dot = document.createElement('span');
                    dot.className = 'feedback-dot';
                    if (feedback[col] === 'green') dot.classList.add('green');
                    else if (feedback[col] === 'orange') dot.classList.add('orange');
                    else dot.classList.add('empty');
                    dot.setAttribute('aria-label', feedback[col] === 'green' ? 'Correct' : feedback[col] === 'orange' ? 'Wrong position' : 'Empty');
                    fr.appendChild(dot);
                }
                feedbackCol.appendChild(fr);
            } else if (isActive) {
                feedbackCol.innerHTML = '<span class="meta-pill" style="border:none;font-size:0.75em;">Your turn</span>';
            }

            rowEl.appendChild(slotsWrap);
            rowEl.appendChild(feedbackCol);
            this.boardEl.appendChild(rowEl);
        }
    };

    CodebreakerGame.prototype.submitGuess = function () {
        var cfg = this.getConfig();
        if (!cfg || this.gameStatus !== 'playing') return;
        if (this.currentGuess.length !== cfg.codeLength) return;

        var guess = this.currentGuess.slice();
        var feedback = computeFeedback(this.secretCode, guess);
        this.attempts.push({ guess: guess, feedback: feedback });
        this.currentGuess = [];
        this.updateAttemptsLabel();

        var allGreen = feedback.every(function (f) {
            return f === 'green';
        });
        if (allGreen) {
            this.gameStatus = 'won';
            this.statusMessage.textContent = 'You cracked the code!';
            this.renderBoard();
            this.updateControls();
            this.showModal(true);
            return;
        }

        if (this.attempts.length >= MAX_ATTEMPTS) {
            this.gameStatus = 'lost';
            this.statusMessage.textContent = 'No attempts left.';
            this.renderBoard();
            this.updateControls();
            this.showModal(false);
            return;
        }

        this.statusMessage.textContent = 'Keep going—refine your next guess.';
        this.renderBoard();
        this.updateControls();
    };

    document.addEventListener('DOMContentLoaded', function () {
        var game = new CodebreakerGame();
        game.init();
    });
})();
