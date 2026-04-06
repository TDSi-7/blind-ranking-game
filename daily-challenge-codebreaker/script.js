/**
 * Codebreaker — Daily Challenge (medium: 7 slots, 7 colors). Seeded secret per UTC day.
 */
(function () {
    'use strict';

    var CHALLENGE_ID = 'codebreaker';
    var MAX_ATTEMPTS = 7;
    var ATTEMPT_LOCK_KEY = 'daily_challenge_attempt_lock_v2';

    var MEDIUM = {
        label: 'Medium',
        codeLength: 7,
        colors: ['Yellow', 'Orange', 'Red', 'Green', 'Purple', 'Blue', 'Brown']
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

    var Seed = window.JonesGamesDailySeed;
    var Auth = window.JonesGamesAuth;

    function getTodayDateUTC() {
        return Seed ? Seed.getTodayDateUTC() : '';
    }

    function formatDisplayDateUTC(dateStr) {
        return Seed ? Seed.formatDisplayDateUTC(dateStr) : '';
    }

    function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function getTodaySecret() {
        var dateStr = getTodayDateUTC();
        var seed = Seed.hashString('daily-codebreaker-' + dateStr);
        var rng = Seed.mulberry32(seed);
        var out = [];
        var i;
        var n = MEDIUM.colors.length;
        for (i = 0; i < MEDIUM.codeLength; i++) {
            out.push(MEDIUM.colors[Math.floor(rng() * n)]);
        }
        return out;
    }

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

    function getBoardRowOrder(game) {
        var mobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches;
        if (!mobile) {
            var order = [];
            var i;
            for (i = 0; i < MAX_ATTEMPTS; i++) order.push(i);
            return order;
        }
        var playing = game.gameStatus === 'playing';
        var n = game.attempts.length;
        var out = [];
        var r;
        if (playing && n < MAX_ATTEMPTS) out.push(n);
        if (n > 0) {
            for (r = n - 1; r >= 0; r--) out.push(r);
        }
        if (playing) {
            for (r = n + 1; r < MAX_ATTEMPTS; r++) out.push(r);
        }
        return out;
    }

    var loginRequiredScreen, alreadyCompletedScreen, startScreen, gameScreen, gameOverScreen;
    var alreadyCompletedTimeEl, alreadyCompletedLeaderboardListEl;
    var adminResetControlsEl, adminResetTodayBtnEl, adminResetStatusEl;
    var startBtn, dailyStatusBannerEl, dailyDateEl;
    var preplayLeaderboardContainerEl, preplayLeaderboardListEl;
    var boardEl, paletteEl, submitBtn, backspaceBtn, clearRowBtn;
    var attemptsLabel, statusMessage, timerDisplayEl;
    var gameOverTitleEl, gameOverMessageEl, completionTimeTextEl, secretRevealEl;
    var leaderboardPromptEl, leaderboardContainerEl, leaderboardListEl;

    var secretCode = [];
    var attempts = [];
    var currentGuess = [];
    var gameStatus = 'idle';
    var playStartTime = null;
    var timerInterval = null;

    var hasCompletedTodayThisSession = false;
    var lastAttemptRecord = null;
    var lastAttemptDisplayName = 'Player';
    var attemptLockUserId = null;
    var isCurrentUserAdmin = false;

    var allScreens = [];

    function showScreen(name) {
        allScreens.forEach(function (s) { if (s) s.classList.remove('active'); });
        var map = {
            loginRequiredScreen: loginRequiredScreen,
            alreadyCompletedScreen: alreadyCompletedScreen,
            startScreen: startScreen,
            gameScreen: gameScreen,
            gameOverScreen: gameOverScreen
        };
        if (map[name]) map[name].classList.add('active');
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function getSessionWithRetry(retries, delayMs) {
        if (!Auth || !Auth.getSession) return Promise.resolve(null);
        var ensureInit = Promise.resolve();
        if (Auth.getClient && !Auth.getClient() && window.__JonesGamesAuthInit__) {
            ensureInit = window.__JonesGamesAuthInit__().catch(function () {});
        }
        return ensureInit.then(function () {
            return Auth.getSession();
        }).then(function (session) {
            if (session) return session;
            if (retries <= 0) return null;
            return sleep(delayMs).then(function () {
                return getSessionWithRetry(retries - 1, delayMs);
            });
        }).catch(function () {
            if (retries <= 0) return null;
            return sleep(delayMs).then(function () {
                return getSessionWithRetry(retries - 1, delayMs);
            });
        });
    }

    function getAttemptLockMap() {
        try {
            var raw = localStorage.getItem(ATTEMPT_LOCK_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveAttemptLockMap(map) {
        try {
            localStorage.setItem(ATTEMPT_LOCK_KEY, JSON.stringify(map || {}));
        } catch (e) {}
    }

    function getLocalAttemptLock(userId, dateStr) {
        if (!userId || !dateStr) return null;
        var map = getAttemptLockMap();
        if (!map[userId] || !map[userId][CHALLENGE_ID] || !map[userId][CHALLENGE_ID][dateStr]) return null;
        return map[userId][CHALLENGE_ID][dateStr];
    }

    function setLocalAttemptLock(userId, dateStr, record) {
        if (!userId || !dateStr) return;
        var map = getAttemptLockMap();
        if (!map[userId]) map[userId] = {};
        if (!map[userId][CHALLENGE_ID]) map[userId][CHALLENGE_ID] = {};
        map[userId][CHALLENGE_ID][dateStr] = {
            score: typeof record.score === 'number' ? record.score : 0,
            completion_time_seconds: typeof record.completion_time_seconds === 'number' ? record.completion_time_seconds : 0,
            completed_at: record.completed_at || new Date().toISOString()
        };
        saveAttemptLockMap(map);
    }

    function clearLocalAttemptLock(userId, dateStr) {
        if (!userId || !dateStr) return;
        var map = getAttemptLockMap();
        if (!map[userId] || !map[userId][CHALLENGE_ID] || !map[userId][CHALLENGE_ID][dateStr]) return;
        delete map[userId][CHALLENGE_ID][dateStr];
        if (Object.keys(map[userId][CHALLENGE_ID]).length === 0) delete map[userId][CHALLENGE_ID];
        if (Object.keys(map[userId]).length === 0) delete map[userId];
        saveAttemptLockMap(map);
    }

    function clearPlayTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        if (playStartTime === null) {
            if (timerDisplayEl) timerDisplayEl.textContent = '0:00';
            return;
        }
        var elapsed = Math.floor((Date.now() - playStartTime) / 1000);
        if (timerDisplayEl) timerDisplayEl.textContent = formatTime(elapsed);
    }

    function checkDailyState() {
        return getSessionWithRetry(20, 250).then(function (session) {
            if (!session || !session.user) return { loggedIn: false, completedToday: false, myCompletion: null };
            attemptLockUserId = session.user.id;
            var client = Auth.getClient();
            var dateStr = getTodayDateUTC();
            var localLock = getLocalAttemptLock(session.user.id, dateStr);
            if (!client) {
                return { loggedIn: true, completedToday: !!localLock, myCompletion: localLock };
            }
            return client.from('daily_challenge_completions').select('score, completion_time_seconds, completed_at').eq('user_id', session.user.id).eq('date', dateStr).eq('challenge_id', CHALLENGE_ID).maybeSingle().then(function (res) {
                var data = res.data;
                var completion = data || localLock || null;
                return { loggedIn: true, completedToday: !!completion, myCompletion: completion };
            }).catch(function () {
                return { loggedIn: true, completedToday: !!localLock, myCompletion: localLock };
            });
        }).catch(function () { return { loggedIn: false, completedToday: false, myCompletion: null }; });
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function renderRecordRows(rows) {
        var filteredRows = (rows || []).filter(function (row) {
            return String((row && row.display_name) || '').trim().toLowerCase() !== 'si test';
        });
        return filteredRows.map(function (row, i) {
            var name = escapeHtml(row.display_name || 'Player');
            var score = typeof row.score === 'number' ? row.score : 0;
            var duration = typeof row.completion_time_seconds === 'number' ? formatTime(row.completion_time_seconds) : '-';
            var rank = i + 1;
            var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            var rankClass = rank <= 3 ? ' class="rank-' + rank + '"' : '';
            return '<tr' + rankClass + '><td><span class="rank-badge"><span class="medal">' + medal + '</span><span>' + rank + '</span></span></td><td>' + name + '</td><td>' + score + '</td><td>' + duration + '</td></tr>';
        }).join('');
    }

    function withLocalAttemptRecord(rows, dateStr) {
        var list = Array.isArray(rows) ? rows.slice() : [];
        if (dateStr !== getTodayDateUTC() || !lastAttemptRecord) return list;
        var localRow = {
            display_name: lastAttemptDisplayName || 'Player',
            score: typeof lastAttemptRecord.score === 'number' ? lastAttemptRecord.score : 0,
            completion_time_seconds: typeof lastAttemptRecord.completion_time_seconds === 'number' ? lastAttemptRecord.completion_time_seconds : 0,
            completed_at: lastAttemptRecord.completed_at || new Date().toISOString()
        };
        var alreadyExists = list.some(function (row) {
            return row
                && Number(row.score) === Number(localRow.score)
                && Number(row.completion_time_seconds) === Number(localRow.completion_time_seconds)
                && String(row.display_name || '') === String(localRow.display_name || '');
        });
        if (!alreadyExists) list.push(localRow);
        list.sort(function (a, b) {
            var scoreA = typeof a.score === 'number' ? a.score : 0;
            var scoreB = typeof b.score === 'number' ? b.score : 0;
            if (scoreA !== scoreB) return scoreB - scoreA;
            var tA = typeof a.completion_time_seconds === 'number' ? a.completion_time_seconds : Number.MAX_SAFE_INTEGER;
            var tB = typeof b.completion_time_seconds === 'number' ? b.completion_time_seconds : Number.MAX_SAFE_INTEGER;
            return tA - tB;
        });
        return list;
    }

    function loadLeaderboardInto(dateStr, listEl) {
        if (!listEl) return;
        var client = Auth.getClient();
        if (!client) {
            listEl.innerHTML = '<tr><td colspan="4">Leaderboard unavailable: not connected.</td></tr>';
            return;
        }
        listEl.innerHTML = '<tr><td colspan="4">Loading records...</td></tr>';
        client.from('daily_challenge_completions').select('display_name, score, completion_time_seconds, completed_at').eq('date', dateStr).eq('challenge_id', CHALLENGE_ID).order('score', { ascending: false }).order('completion_time_seconds', { ascending: true }).then(function (res) {
            if (res.error) {
                var localOnlyRows = withLocalAttemptRecord([], dateStr);
                listEl.innerHTML = localOnlyRows.length ? renderRecordRows(localOnlyRows) : '<tr><td colspan="4">Could not load records right now.</td></tr>';
                return;
            }
            var mergedRows = withLocalAttemptRecord(res.data || [], dateStr);
            listEl.innerHTML = renderRecordRows(mergedRows) || '<tr><td colspan="4">No records yet.</td></tr>';
        });
    }

    function loadLeaderboard(dateStr) {
        var client = Auth.getClient();
        if (!client) {
            if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';
            if (leaderboardListEl) leaderboardListEl.innerHTML = '<tr><td colspan="4">Leaderboard unavailable: not connected.</td></tr>';
            return;
        }
        if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';
        if (leaderboardListEl) leaderboardListEl.innerHTML = '<tr><td colspan="4">Loading records...</td></tr>';
        client.from('daily_challenge_completions')
            .select('display_name, score, completion_time_seconds, completed_at')
            .eq('date', dateStr)
            .eq('challenge_id', CHALLENGE_ID)
            .order('score', { ascending: false })
            .order('completion_time_seconds', { ascending: true })
            .then(function (res) {
                if (res.error) {
                    var localOnlyRows = withLocalAttemptRecord([], dateStr);
                    leaderboardListEl.innerHTML = localOnlyRows.length ? renderRecordRows(localOnlyRows) : '<tr><td colspan="4">Could not load records right now.</td></tr>';
                    return;
                }
                leaderboardContainerEl.style.display = 'block';
                var mergedRows = withLocalAttemptRecord(res.data || [], dateStr);
                leaderboardListEl.innerHTML = renderRecordRows(mergedRows) || '<tr><td colspan="4">No records yet.</td></tr>';
            });
    }

    function submitAndShowLeaderboard(score, completionTimeSeconds) {
        var client = Auth.getClient();
        if (!client) {
            if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';
            if (leaderboardListEl) leaderboardListEl.innerHTML = '<tr><td colspan="4">Could not save your result right now.</td></tr>';
            return;
        }
        var dateStr = getTodayDateUTC();
        client.auth.getSession().then(function (_ref) {
            var session = _ref.data.session;
            var user = session && session.user;
            if (!user) return Promise.resolve();
            var meta = user.user_metadata || {};
            var fallbackName = (meta.full_name || meta.name || user.email || 'Player').trim() || 'Player';
            var displayNamePromise = (window.JonesGamesSync && window.JonesGamesSync.getProfile)
                ? window.JonesGamesSync.getProfile().then(function (p) { return (p && p.display_name) ? p.display_name : fallbackName; })
                : Promise.resolve(fallbackName);

            return displayNamePromise.then(function (displayName) {
                lastAttemptDisplayName = displayName || 'Player';
                return client.from('daily_challenge_completions').select('user_id').eq('user_id', user.id).eq('date', dateStr).eq('challenge_id', CHALLENGE_ID).maybeSingle().then(function (existing) {
                    if (existing.data) {
                        return { skipped: true };
                    }
                    return client.from('daily_challenge_completions').insert({
                        user_id: user.id,
                        date: dateStr,
                        challenge_id: CHALLENGE_ID,
                        score: score,
                        completion_time_seconds: completionTimeSeconds,
                        completed_at: new Date().toISOString(),
                        display_name: displayName,
                        updated_at: new Date().toISOString()
                    });
                });
            });
        }).then(function (res) {
            if (res && res.skipped) {
                hasCompletedTodayThisSession = true;
                lastAttemptRecord = { score: score, completion_time_seconds: completionTimeSeconds, completed_at: new Date().toISOString() };
                if (attemptLockUserId) setLocalAttemptLock(attemptLockUserId, getTodayDateUTC(), lastAttemptRecord);
                setTimeout(function () { loadLeaderboard(getTodayDateUTC()); }, 150);
                return;
            }
            if (res && res.error) {
                console.warn('Submit failed', res.error);
                hasCompletedTodayThisSession = true;
                lastAttemptRecord = { score: score, completion_time_seconds: completionTimeSeconds, completed_at: new Date().toISOString() };
                if (attemptLockUserId) setLocalAttemptLock(attemptLockUserId, getTodayDateUTC(), lastAttemptRecord);
                if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';
                if (leaderboardListEl) leaderboardListEl.innerHTML = '<tr><td colspan="4">Your result was not saved. Please check database migration/policies.</td></tr>';
                setTimeout(function () { loadLeaderboard(getTodayDateUTC()); }, 150);
                return;
            }
            hasCompletedTodayThisSession = true;
            lastAttemptRecord = { score: score, completion_time_seconds: completionTimeSeconds, completed_at: new Date().toISOString() };
            if (attemptLockUserId) setLocalAttemptLock(attemptLockUserId, getTodayDateUTC(), lastAttemptRecord);
            setTimeout(function () { loadLeaderboard(getTodayDateUTC()); }, 150);
        });
    }

    var gameDelegate = {
        gameStatus: 'idle',
        attempts: attempts,
        secretCode: secretCode,
        currentGuess: currentGuess
    };

    function getActiveRowIndex() {
        return attempts.length;
    }

    function updateAttemptsLabel() {
        var used = attempts.length;
        attemptsLabel.textContent = 'Attempts: ' + used + ' / ' + MAX_ATTEMPTS;
    }

    function buildPalette() {
        paletteEl.innerHTML = '';
        MEDIUM.colors.forEach(function (name) {
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
                addColor(name);
            });
            paletteEl.appendChild(b);
        });
    }

    function addColor(name) {
        if (gameStatus !== 'playing') return;
        if (MEDIUM.colors.indexOf(name) < 0) return;
        if (currentGuess.length >= MEDIUM.codeLength) return;
        currentGuess.push(name);
        renderBoard();
        updateControls();
    }

    function backspace() {
        if (gameStatus !== 'playing') return;
        currentGuess.pop();
        renderBoard();
        updateControls();
    }

    function clearCurrentRow() {
        if (gameStatus !== 'playing') return;
        currentGuess = [];
        renderBoard();
        updateControls();
    }

    function updateControls() {
        var full = currentGuess.length === MEDIUM.codeLength;
        var playing = gameStatus === 'playing';
        submitBtn.disabled = !playing || !full;
        backspaceBtn.disabled = !playing || currentGuess.length === 0;
        clearRowBtn.disabled = !playing || currentGuess.length === 0;
        var buttons = paletteEl.querySelectorAll('.palette-btn');
        buttons.forEach(function (btn) {
            btn.disabled = !playing;
        });
    }

    function buildBoardRow(row) {
        var isLocked = row < attempts.length;
        var isActive = !isLocked && row === getActiveRowIndex() && gameStatus === 'playing';
        var rowEl = document.createElement('div');
        rowEl.className = 'board-row';
        if (isLocked) rowEl.classList.add('locked');
        if (isActive) rowEl.classList.add('active');

        var slotsWrap = document.createElement('div');
        slotsWrap.className = 'slots';

        var guess;
        var feedback;
        if (isLocked) {
            guess = attempts[row].guess;
            feedback = attempts[row].feedback;
        } else if (isActive) {
            guess = currentGuess;
            feedback = null;
        } else {
            guess = [];
            feedback = null;
        }

        var col;
        for (col = 0; col < MEDIUM.codeLength; col++) {
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
                fr.appendChild(dot);
            }
            feedbackCol.appendChild(fr);
        } else if (isActive) {
            feedbackCol.innerHTML = '<span class="meta-pill" style="border:none;font-size:0.75em;">Your turn</span>';
        }

        rowEl.appendChild(slotsWrap);
        rowEl.appendChild(feedbackCol);
        return rowEl;
    }

    function renderBoard() {
        gameDelegate.attempts = attempts;
        gameDelegate.gameStatus = gameStatus;
        boardEl.setAttribute('data-slots', String(MEDIUM.codeLength));
        boardEl.innerHTML = '';
        var order = getBoardRowOrder(gameDelegate);
        var idx;
        for (idx = 0; idx < order.length; idx++) {
            var built = buildBoardRow(order[idx]);
            if (built) boardEl.appendChild(built);
        }
    }

    function finishRound(won, score) {
        clearPlayTimer();
        gameStatus = 'ended';
        var completionSeconds = playStartTime !== null ? Math.floor((Date.now() - playStartTime) / 1000) : 0;
        gameOverTitleEl.textContent = won ? 'You cracked the code!' : 'Out of attempts';
        gameOverMessageEl.textContent = won
            ? ('Score: ' + score + ' (higher is better).')
            : 'Score: 0 for today.';
        gameOverMessageEl.style.color = won ? '#4caf50' : '#f44336';
        completionTimeTextEl.textContent = formatTime(completionSeconds);

        secretRevealEl.innerHTML = '';
        secretCode.forEach(function (name) {
            var d = document.createElement('div');
            d.className = 'slot';
            d.style.background = COLOR_HEX[name] || '#ccc';
            d.setAttribute('title', name);
            d.setAttribute('aria-label', name);
            if (name === 'Black' || name === 'Purple' || name === 'Brown') {
                d.style.borderColor = '#666';
            }
            secretRevealEl.appendChild(d);
        });

        showScreen('gameOverScreen');
        if (leaderboardPromptEl) leaderboardPromptEl.style.display = 'none';
        if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';

        Auth.getSession().then(function (session) {
            if (session && session.user) {
                setLocalAttemptLock(session.user.id, getTodayDateUTC(), {
                    score: score,
                    completion_time_seconds: completionSeconds,
                    completed_at: new Date().toISOString()
                });
                submitAndShowLeaderboard(score, completionSeconds);
            } else {
                if (leaderboardPromptEl) leaderboardPromptEl.style.display = 'block';
                if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'none';
            }
        });
    }

    function submitGuess() {
        if (gameStatus !== 'playing') return;
        if (currentGuess.length !== MEDIUM.codeLength) return;

        if (playStartTime === null) {
            playStartTime = Date.now();
            timerInterval = setInterval(updateTimerDisplay, 200);
        }

        var guess = currentGuess.slice();
        var feedback = computeFeedback(secretCode, guess);
        attempts.push({ guess: guess, feedback: feedback });
        currentGuess = [];
        updateAttemptsLabel();

        var allGreen = feedback.every(function (f) {
            return f === 'green';
        });
        if (allGreen) {
            var score = 8 - attempts.length;
            finishRound(true, score);
            return;
        }

        if (attempts.length >= MAX_ATTEMPTS) {
            finishRound(false, 0);
            return;
        }

        statusMessage.textContent = 'Keep going—refine your next guess.';
        renderBoard();
        updateControls();
    }

    function startRound() {
        secretCode = getTodaySecret();
        attempts = [];
        currentGuess = [];
        gameStatus = 'playing';
        playStartTime = null;
        clearPlayTimer();
        if (timerDisplayEl) timerDisplayEl.textContent = '0:00';
        updateAttemptsLabel();
        statusMessage.textContent = 'Fill the highlighted row and submit your guess.';
        buildPalette();
        renderBoard();
        updateControls();
        showScreen('gameScreen');
    }

    function showAlreadyCompletedView(myCompletion) {
        showScreen('alreadyCompletedScreen');
        if (alreadyCompletedTimeEl && myCompletion) {
            var myScore = typeof myCompletion.score === 'number' ? myCompletion.score : 0;
            var myDuration = typeof myCompletion.completion_time_seconds === 'number' ? formatTime(myCompletion.completion_time_seconds) : '-';
            alreadyCompletedTimeEl.textContent = 'Your result: score ' + myScore + ' in ' + myDuration;
        }
        loadLeaderboardInto(getTodayDateUTC(), alreadyCompletedLeaderboardListEl);
    }

    function refreshPreplayLeaderboard() {
        if (!preplayLeaderboardContainerEl || !preplayLeaderboardListEl) return;
        preplayLeaderboardContainerEl.style.display = 'block';
        loadLeaderboardInto(getTodayDateUTC(), preplayLeaderboardListEl);
    }

    function updateAdminResetControls() {
        if (!adminResetControlsEl) return;
        adminResetControlsEl.style.display = isCurrentUserAdmin ? 'block' : 'none';
    }

    function checkAdminAccess() {
        var client = Auth.getClient();
        if (!client) return Promise.resolve(false);
        return client.rpc('is_current_user_admin').then(function (res) {
            if (res.error) return false;
            return !!res.data;
        }).catch(function () { return false; });
    }

    function runAdminResetToday() {
        if (!isCurrentUserAdmin) return;
        if (!confirm('Reset today\'s Codebreaker daily for all users?')) return;
        var client = Auth.getClient();
        if (!client) return;
        if (adminResetStatusEl) adminResetStatusEl.textContent = 'Resetting today...';
        client.rpc('admin_reset_daily_challenge', { target_date: getTodayDateUTC(), target_challenge_id: CHALLENGE_ID }).then(function (res) {
            if (res.error) {
                if (adminResetStatusEl) adminResetStatusEl.textContent = 'Reset failed: ' + (res.error.message || 'unknown error');
                return;
            }
            if (adminResetStatusEl) adminResetStatusEl.textContent = 'Reset complete. Removed ' + (res.data || 0) + ' rows.';
            if (attemptLockUserId) clearLocalAttemptLock(attemptLockUserId, getTodayDateUTC());
            hasCompletedTodayThisSession = false;
            lastAttemptRecord = null;
            updateStartStatusBanner(false, null);
            showScreen('startScreen');
        }).catch(function () {
            if (adminResetStatusEl) adminResetStatusEl.textContent = 'Reset failed. Try again.';
        });
    }

    function updateStartStatusBanner(hasCompletedToday, myCompletion) {
        if (!startBtn || !dailyStatusBannerEl) return;
        if (hasCompletedToday) {
            var scoreText = (myCompletion && typeof myCompletion.score === 'number') ? String(myCompletion.score) : '-';
            var durationText = (myCompletion && typeof myCompletion.completion_time_seconds === 'number') ? formatTime(myCompletion.completion_time_seconds) : '-';
            dailyStatusBannerEl.textContent = 'You have already played today: score ' + scoreText + ' in ' + durationText + '.';
            dailyStatusBannerEl.style.display = 'block';
            startBtn.textContent = 'Today\'s challenge completed';
            return;
        }
        dailyStatusBannerEl.style.display = 'none';
        dailyStatusBannerEl.textContent = '';
        startBtn.textContent = 'Start today\'s challenge';
    }

    function applyView(state) {
        if (!state.loggedIn) {
            showScreen('loginRequiredScreen');
            return;
        }
        refreshPreplayLeaderboard();
        updateStartStatusBanner(state.completedToday, state.myCompletion);
        if (state.completedToday) {
            hasCompletedTodayThisSession = true;
            lastAttemptRecord = state.myCompletion || null;
            showAlreadyCompletedView(state.myCompletion);
            return;
        }
        showScreen('startScreen');
    }

    function refreshStateFromAuth() {
        return checkDailyState().then(function (state) {
            var profileNamePromise = (window.JonesGamesSync && window.JonesGamesSync.getProfile)
                ? window.JonesGamesSync.getProfile().then(function (p) { return (p && p.display_name) ? p.display_name : null; }).catch(function () { return null; })
                : Promise.resolve(null);
            return profileNamePromise.then(function (profileName) {
                if (profileName) lastAttemptDisplayName = profileName;
                return state;
            });
        }).then(function (state) {
            return checkAdminAccess().then(function (isAdmin) {
                isCurrentUserAdmin = isAdmin;
                updateAdminResetControls();
                return state;
            });
        }).then(applyView);
    }

    function init() {
        if (window.__JonesGamesAuthInit__) window.__JonesGamesAuthInit__();
        loginRequiredScreen = document.getElementById('loginRequiredScreen');
        alreadyCompletedScreen = document.getElementById('alreadyCompletedScreen');
        startScreen = document.getElementById('startScreen');
        gameScreen = document.getElementById('gameScreen');
        gameOverScreen = document.getElementById('gameOverScreen');
        allScreens = [loginRequiredScreen, alreadyCompletedScreen, startScreen, gameScreen, gameOverScreen];

        alreadyCompletedTimeEl = document.getElementById('alreadyCompletedTime');
        alreadyCompletedLeaderboardListEl = document.getElementById('alreadyCompletedLeaderboardList');
        adminResetControlsEl = document.getElementById('adminResetControls');
        adminResetTodayBtnEl = document.getElementById('adminResetTodayBtn');
        adminResetStatusEl = document.getElementById('adminResetStatus');
        startBtn = document.getElementById('startBtn');
        dailyStatusBannerEl = document.getElementById('dailyStatusBanner');
        dailyDateEl = document.getElementById('dailyDate');
        preplayLeaderboardContainerEl = document.getElementById('preplayLeaderboardContainer');
        preplayLeaderboardListEl = document.getElementById('preplayLeaderboardList');

        boardEl = document.getElementById('board');
        paletteEl = document.getElementById('palette');
        submitBtn = document.getElementById('submitBtn');
        backspaceBtn = document.getElementById('backspaceBtn');
        clearRowBtn = document.getElementById('clearRowBtn');
        attemptsLabel = document.getElementById('attemptsLabel');
        statusMessage = document.getElementById('statusMessage');
        timerDisplayEl = document.getElementById('timerDisplay');

        gameOverTitleEl = document.getElementById('gameOverTitle');
        gameOverMessageEl = document.getElementById('gameOverMessage');
        completionTimeTextEl = document.getElementById('completionTimeText');
        secretRevealEl = document.getElementById('secretReveal');
        leaderboardPromptEl = document.getElementById('leaderboardPrompt');
        leaderboardContainerEl = document.getElementById('leaderboardContainer');
        leaderboardListEl = document.getElementById('leaderboardList');

        if (dailyDateEl) dailyDateEl.textContent = 'Today: ' + formatDisplayDateUTC(getTodayDateUTC());

        var loginLink = loginRequiredScreen ? loginRequiredScreen.querySelector('.btn-start') : null;
        if (loginLink) {
            loginLink.addEventListener('click', function (e) {
                e.preventDefault();
                refreshStateFromAuth().then(function () {
                    if (startScreen && startScreen.classList.contains('active')) return;
                    if (alreadyCompletedScreen && alreadyCompletedScreen.classList.contains('active')) return;
                    window.location.href = '../index.html';
                });
            });
        }

        startBtn.addEventListener('click', function () {
            if (hasCompletedTodayThisSession) {
                showAlreadyCompletedView(lastAttemptRecord);
                return;
            }
            startRound();
        });
        submitBtn.addEventListener('click', submitGuess);
        backspaceBtn.addEventListener('click', backspace);
        clearRowBtn.addEventListener('click', clearCurrentRow);
        if (adminResetTodayBtnEl) adminResetTodayBtnEl.addEventListener('click', runAdminResetToday);

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            if (!gameScreen || !gameScreen.classList.contains('active')) return;
            if (gameStatus !== 'playing') return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                renderBoard();
            }, 120);
        });

        (window.__JonesGamesAuthInit__ ? window.__JonesGamesAuthInit__() : Promise.resolve()).then(function () {
            return refreshStateFromAuth();
        });
        if (Auth && Auth.onAuthStateChange) {
            Auth.onAuthStateChange(function () {
                if (gameStatus === 'playing') return;
                refreshStateFromAuth();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
