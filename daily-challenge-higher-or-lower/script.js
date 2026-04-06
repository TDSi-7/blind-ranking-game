/**
 * Higher or Lower — Daily Challenge (medium: 7 cards). Seeded deck per UTC day.
 */
(function () {
    'use strict';

    var CHALLENGE_ID = 'higher_or_lower';
    var CARD_COUNT = 7;
    var ATTEMPT_LOCK_KEY = 'daily_challenge_attempt_lock_v2';

    var Seed = window.JonesGamesDailySeed;
    var Auth = window.JonesGamesAuth;

    var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

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

    function getTodaysRowAndChain() {
        var dateStr = getTodayDateUTC();
        var seed = Seed.hashString('daily-hol-' + dateStr);
        var rng = Seed.mulberry32(seed);
        var deck = Seed.shuffleSeeded(buildDeck(), rng);
        var n = CARD_COUNT;
        return {
            row: deck.slice(0, n),
            starter: deck[n]
        };
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

    var loginRequiredScreen, alreadyCompletedScreen, startScreen, gameScreen, gameOverScreen;
    var alreadyCompletedTimeEl, alreadyCompletedLeaderboardListEl;
    var adminResetControlsEl, adminResetTodayBtnEl, adminResetStatusEl;
    var startBtn, dailyStatusBannerEl, dailyDateEl;
    var preplayLeaderboardContainerEl, preplayLeaderboardListEl;
    var chainCards, tableRow, higherBtn, lowerBtn, streakLabel, statusMessage;
    var timerDisplayEl;
    var gameOverTitleEl, gameOverMessageEl, completionTimeTextEl, leaderboardPromptEl, leaderboardContainerEl, leaderboardListEl;

    var row = [];
    var chain = [];
    var nextIdx = 0;
    var streak = 0;
    var gameState = 'idle';
    var resolving = false;
    var showLosingCard = false;
    var lossTimeoutId = null;
    var guessStartTime = null;
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
        var target = map[name];
        if (target) target.classList.add('active');
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

    function clearTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        if (guessStartTime === null) {
            if (timerDisplayEl) timerDisplayEl.textContent = '0:00';
            return;
        }
        var elapsed = Math.floor((Date.now() - guessStartTime) / 1000);
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

    function setGuessButtons(enabled) {
        higherBtn.disabled = !enabled;
        lowerBtn.disabled = !enabled;
    }

    function updateStreakLabel() {
        streakLabel.textContent = 'Streak: ' + streak;
    }

    function renderChain() {
        var i;
        chainCards.innerHTML = '';
        for (i = 0; i < chain.length; i++) {
            var wrap = document.createElement('div');
            renderCardFace(wrap, chain[i], 'card--chain');
            chainCards.appendChild(wrap);
        }
    }

    function renderTable() {
        var i;
        tableRow.innerHTML = '';
        for (i = 0; i < row.length; i++) {
            var wrap = document.createElement('div');
            if (i < nextIdx) {
                renderSmallCard(wrap, row[i]);
            } else if (showLosingCard && i === nextIdx) {
                renderSmallCard(wrap, row[i]);
                var inner = wrap.querySelector('.card');
                if (inner) inner.classList.add('card--wrong-reveal');
            } else {
                renderCardBack(wrap, i);
            }
            tableRow.appendChild(wrap);
        }
    }

    function getCurrent() {
        if (!chain.length) return null;
        return chain[chain.length - 1];
    }

    function checkWin() {
        if (nextIdx >= row.length) {
            gameState = 'ended';
            setGuessButtons(false);
            finishRound(true);
            return true;
        }
        return false;
    }

    function finishRound(won) {
        clearTimer();
        var completionSeconds = guessStartTime !== null ? Math.floor((Date.now() - guessStartTime) / 1000) : 0;
        gameOverTitleEl.textContent = won ? 'You cleared the row!' : 'Game over';
        gameOverMessageEl.textContent = won
            ? 'Nice! You guessed every card right.'
            : 'Wrong guess — your streak ends here.';
        gameOverMessageEl.style.color = won ? '#4caf50' : '#f44336';
        completionTimeTextEl.textContent = formatTime(completionSeconds);
        showScreen('gameOverScreen');
        if (leaderboardPromptEl) leaderboardPromptEl.style.display = 'none';
        if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';

        Auth.getSession().then(function (session) {
            if (session && session.user) {
                setLocalAttemptLock(session.user.id, getTodayDateUTC(), {
                    score: streak,
                    completion_time_seconds: completionSeconds,
                    completed_at: new Date().toISOString()
                });
                submitAndShowLeaderboard(streak, completionSeconds);
            } else {
                if (leaderboardPromptEl) leaderboardPromptEl.style.display = 'block';
                if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'none';
            }
        });
    }

    function beginTurn() {
        if (gameState !== 'playing') return;
        if (checkWin()) return;

        var cur = getCurrent();
        var next = row[nextIdx];
        if (next.value === cur.value) {
            resolving = true;
            setGuessButtons(false);
            statusMessage.textContent = 'Same rank — the next card flips for free.';
            window.setTimeout(function () {
                if (gameState !== 'playing') return;
                chain.push(next);
                nextIdx += 1;
                resolving = false;
                renderChain();
                renderTable();
                statusMessage.textContent = '';
                if (checkWin()) return;
                beginTurn();
            }, 700);
            return;
        }

        statusMessage.textContent =
            'Is the next hidden card higher or lower than your ' + cur.rank + '?';
        setGuessButtons(true);
    }

    function onGuess(wantHigher) {
        if (gameState !== 'playing' || resolving) return;
        if (nextIdx >= row.length) return;

        if (guessStartTime === null) {
            guessStartTime = Date.now();
            timerInterval = setInterval(updateTimerDisplay, 200);
        }

        var cur = getCurrent();
        var next = row[nextIdx];
        if (next.value === cur.value) {
            beginTurn();
            return;
        }

        setGuessButtons(false);

        var higherWins = next.value > cur.value;
        var correct = wantHigher ? higherWins : !higherWins;

        if (!correct) {
            gameState = 'loss_pending';
            showLosingCard = true;
            renderTable();
            statusMessage.textContent =
                'The next card was the ' + next.rank + ' of ' + suitAria(next.suit) + '.';
            lossTimeoutId = window.setTimeout(function () {
                lossTimeoutId = null;
                gameState = 'ended';
                finishRound(false);
            }, 2000);
            return;
        }

        streak += 1;
        updateStreakLabel();
        chain.push(next);
        nextIdx += 1;
        renderChain();
        renderTable();
        setGuessButtons(false);
        beginTurn();
    }

    function startRound() {
        if (lossTimeoutId) {
            clearTimeout(lossTimeoutId);
            lossTimeoutId = null;
        }
        var deal = getTodaysRowAndChain();
        row = deal.row;
        chain = [deal.starter];
        nextIdx = 0;
        streak = 0;
        resolving = false;
        showLosingCard = false;
        gameState = 'playing';
        guessStartTime = null;
        clearTimer();
        if (timerDisplayEl) timerDisplayEl.textContent = '0:00';
        updateStreakLabel();
        statusMessage.textContent = '';
        renderChain();
        renderTable();
        setGuessButtons(false);
        showScreen('gameScreen');
        beginTurn();
    }

    function showAlreadyCompletedView(myCompletion) {
        showScreen('alreadyCompletedScreen');
        if (alreadyCompletedTimeEl && myCompletion) {
            var myScore = typeof myCompletion.score === 'number' ? myCompletion.score : 0;
            var myDuration = typeof myCompletion.completion_time_seconds === 'number' ? formatTime(myCompletion.completion_time_seconds) : '-';
            alreadyCompletedTimeEl.textContent = 'Your result: streak ' + myScore + ' in ' + myDuration;
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
        if (!confirm('Reset today\'s Higher or Lower daily for all users?')) return;
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
            dailyStatusBannerEl.textContent = 'You have already played today: streak ' + scoreText + ' in ' + durationText + '.';
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

        chainCards = document.getElementById('chainCards');
        tableRow = document.getElementById('tableRow');
        higherBtn = document.getElementById('higherBtn');
        lowerBtn = document.getElementById('lowerBtn');
        streakLabel = document.getElementById('streakLabel');
        statusMessage = document.getElementById('statusMessage');
        timerDisplayEl = document.getElementById('timerDisplay');

        gameOverTitleEl = document.getElementById('gameOverTitle');
        gameOverMessageEl = document.getElementById('gameOverMessage');
        completionTimeTextEl = document.getElementById('completionTimeText');
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
        higherBtn.addEventListener('click', function () { onGuess(true); });
        lowerBtn.addEventListener('click', function () { onGuess(false); });
        if (adminResetTodayBtnEl) adminResetTodayBtnEl.addEventListener('click', runAdminResetToday);

        (window.__JonesGamesAuthInit__ ? window.__JonesGamesAuthInit__() : Promise.resolve()).then(function () {
            return refreshStateFromAuth();
        });
        if (Auth && Auth.onAuthStateChange) {
            Auth.onAuthStateChange(function () {
                if (gameState === 'playing') return;
                refreshStateFromAuth();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
