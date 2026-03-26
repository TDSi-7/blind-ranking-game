/**
 * Daily Challenge – Blind Ranking: one puzzle per day, same for everyone.
 * Numbers from seeded RNG (date-based). Timer from first number to 10th placed.
 */
(function () {
    function getTodayDateUTC() {
        var d = new Date();
        var y = d.getUTCFullYear();
        var m = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function hashString(str) {
        var h = 0;
        for (var i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i) | 0;
        }
        return Math.abs(h) >>> 0;
    }

    function mulberry32(seed) {
        return function () {
            var t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function getTodaysNumbers() {
        var dateStr = getTodayDateUTC();
        var seed = hashString('daily-blind-ranking-' + dateStr);
        var rng = mulberry32(seed);
        var pool = [];
        for (var i = 1; i <= 100; i++) pool.push(i);
        var out = [];
        for (var j = 0; j < 10; j++) {
            var idx = Math.floor(rng() * pool.length);
            out.push(pool.splice(idx, 1)[0]);
        }
        return out;
    }

    function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function getOrdinalSuffix(day) {
        if (day % 100 >= 11 && day % 100 <= 13) return 'th';
        var last = day % 10;
        if (last === 1) return 'st';
        if (last === 2) return 'nd';
        if (last === 3) return 'rd';
        return 'th';
    }

    function formatDisplayDateUTC(dateStr) {
        if (!dateStr) return '';
        var parts = String(dateStr).split('-');
        if (parts.length !== 3) return dateStr;
        var y = Number(parts[0]);
        var m = Number(parts[1]) - 1;
        var d = Number(parts[2]);
        var utcDate = new Date(Date.UTC(y, m, d));
        if (isNaN(utcDate.getTime())) return dateStr;
        var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return weekdays[utcDate.getUTCDay()] + ' ' + d + getOrdinalSuffix(d) + ' ' + months[m];
    }

    var Auth = window.JonesGamesAuth;
    var startScreen, gameScreen, gameOverScreen;
    var loginRequiredScreen, alreadyCompletedScreen, completeToSeeLeaderboardScreen;
    var alreadyCompletedTimeEl, alreadyCompletedLeaderboardListEl;
    var adminResetControlsEl, adminResetTodayBtnEl, adminResetStatusEl;
    var startBtn, nextNumberBtn;
    var dailyStatusBannerEl;
    var currentNumberEl, numbersPlacedEl, timerDisplayEl, gameTitleEl;
    var slotElements;
    var gameOverTitleEl, gameOverMessageEl, finalScoreEl;
    var completedSection, completionTimeTextEl, leaderboardPromptEl, leaderboardContainerEl, leaderboardListEl;

    var slots = new Array(11);
    var numbers = [];
    var numbersIndex = 0;
    var currentNumber = null;
    var numbersPlaced = 0;
    var gameActive = false;
    var startTime = null;
    var timerInterval = null;
    var currentMovableSlot = null;
    var dragSourceSlotIndex = null;
    var tapMoveSource = null;
    var touchDragSourceIndex = null;
    var hasCompletedTodayThisSession = false;
    var lastAttemptRecord = null;
    var lastAttemptDisplayName = 'Player';
    var attemptLockUserId = null;
    var ATTEMPT_LOCK_KEY = 'daily_challenge_attempt_lock_v1';
    var isCurrentUserAdmin = false;

    function getEl(id) { return document.getElementById(id); }

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
        if (!map[userId] || !map[userId][dateStr]) return null;
        return map[userId][dateStr];
    }

    function setLocalAttemptLock(userId, dateStr, record) {
        if (!userId || !dateStr) return;
        var map = getAttemptLockMap();
        if (!map[userId]) map[userId] = {};
        map[userId][dateStr] = {
            score: typeof record.score === 'number' ? record.score : 0,
            completion_time_seconds: typeof record.completion_time_seconds === 'number' ? record.completion_time_seconds : 0,
            completed_at: record.completed_at || new Date().toISOString()
        };
        saveAttemptLockMap(map);
    }

    function clearLocalAttemptLock(userId, dateStr) {
        if (!userId || !dateStr) return;
        var map = getAttemptLockMap();
        if (!map[userId] || !map[userId][dateStr]) return;
        delete map[userId][dateStr];
        if (Object.keys(map[userId]).length === 0) delete map[userId];
        saveAttemptLockMap(map);
    }

    var allScreens = [];

    function showScreen(name) {
        allScreens.forEach(function (s) { if (s) s.classList.remove('active'); });
        var target = name === 'startScreen' ? startScreen : name === 'gameScreen' ? gameScreen : name === 'gameOverScreen' ? gameOverScreen : name === 'loginRequiredScreen' ? loginRequiredScreen : name === 'alreadyCompletedScreen' ? alreadyCompletedScreen : name === 'completeToSeeLeaderboardScreen' ? completeToSeeLeaderboardScreen : null;
        if (target) target.classList.add('active');
    }

    function checkDailyState() {
        return Auth.getSession().then(function (session) {
            if (!session || !session.user) return { loggedIn: false, completedToday: false, myCompletion: null };
            attemptLockUserId = session.user.id;
            var client = Auth.getClient();
            var dateStr = getTodayDateUTC();
            var localLock = getLocalAttemptLock(session.user.id, dateStr);
            if (!client) {
                return { loggedIn: true, completedToday: !!localLock, myCompletion: localLock };
            }
            return client.from('daily_challenge_completions').select('score, completion_time_seconds, completed_at').eq('user_id', session.user.id).eq('date', dateStr).maybeSingle().then(function (res) {
                var data = res.data;
                var completion = data || localLock || null;
                return { loggedIn: true, completedToday: !!completion, myCompletion: completion };
            });
        }).catch(function () { return { loggedIn: false, completedToday: false, myCompletion: null }; });
    }

    function showAlreadyCompletedView(myCompletion) {
        showScreen('alreadyCompletedScreen');
        if (alreadyCompletedTimeEl && myCompletion) {
            var myScore = typeof myCompletion.score === 'number' ? myCompletion.score : 0;
            var myDuration = typeof myCompletion.completion_time_seconds === 'number' ? formatTime(myCompletion.completion_time_seconds) : '-';
            alreadyCompletedTimeEl.textContent = 'Your result: ' + myScore + '/10 in ' + myDuration;
        }
        loadLeaderboardInto(getTodayDateUTC(), alreadyCompletedLeaderboardListEl);
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
        if (!confirm('Reset today\\'s Daily Challenge for all users?')) return;
        var client = Auth.getClient();
        if (!client) return;
        if (adminResetStatusEl) adminResetStatusEl.textContent = 'Resetting today...';
        client.rpc('admin_reset_daily_challenge', { target_date: getTodayDateUTC() }).then(function (res) {
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

    function renderRecordRows(rows) {
        return (rows || []).map(function (row, i) {
            var name = escapeHtml(row.display_name || 'Player');
            var score = typeof row.score === 'number' ? row.score : 0;
            var duration = typeof row.completion_time_seconds === 'number' ? formatTime(row.completion_time_seconds) : '-';
            var rank = i + 1;
            var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            var rankClass = rank <= 3 ? ' class="rank-' + rank + '"' : '';
            return '<tr' + rankClass + '><td><span class="rank-badge"><span class="medal">' + medal + '</span><span>' + rank + '</span></span></td><td>' + name + '</td><td>' + score + '/10</td><td>' + duration + '</td></tr>';
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
        client.from('daily_challenge_completions').select('display_name, score, completion_time_seconds, completed_at').eq('date', dateStr).order('score', { ascending: false }).order('completion_time_seconds', { ascending: true }).then(function (res) {
            if (res.error) {
                var localOnlyRows = withLocalAttemptRecord([], dateStr);
                listEl.innerHTML = localOnlyRows.length ? renderRecordRows(localOnlyRows) : '<tr><td colspan="4">Could not load records right now.</td></tr>';
                return;
            }
            var mergedRows = withLocalAttemptRecord(res.data || [], dateStr);
            var html = renderRecordRows(mergedRows);
            listEl.innerHTML = html || '<tr><td colspan="5">No records yet.</td></tr>';
        });
    }

    function applyView(state, viewLeaderboard) {
        if (!state.loggedIn) {
            showScreen('loginRequiredScreen');
            return;
        }
        if (viewLeaderboard && !state.completedToday) {
            showScreen('completeToSeeLeaderboardScreen');
            return;
        }
        updateStartStatusBanner(state.completedToday, state.myCompletion);
        if (state.completedToday) {
            showAlreadyCompletedView(state.myCompletion);
            return;
        }
        showScreen('startScreen');
    }

    function updateStartStatusBanner(hasCompletedToday, myCompletion) {
        if (!startBtn || !dailyStatusBannerEl) return;
        if (hasCompletedToday) {
            var scoreText = (myCompletion && typeof myCompletion.score === 'number') ? (myCompletion.score + '/10') : '-';
            var durationText = (myCompletion && typeof myCompletion.completion_time_seconds === 'number') ? formatTime(myCompletion.completion_time_seconds) : '-';
            dailyStatusBannerEl.textContent = 'You have already played today: ' + scoreText + ' in ' + durationText + '.';
            dailyStatusBannerEl.style.display = 'block';
            startBtn.textContent = 'Today\'s challenge completed';
            return;
        }
        dailyStatusBannerEl.style.display = 'none';
        dailyStatusBannerEl.textContent = '';
        startBtn.textContent = 'Start today’s challenge';
    }

    function hideReplayButtonsIfPresent() {
        var replaySelectors = ['#playAgainBtn', '#restartBtn', '#restartBtnTop'];
        replaySelectors.forEach(function (selector) {
            var el = document.querySelector(selector);
            if (el) {
                el.style.display = 'none';
                el.setAttribute('aria-hidden', 'true');
            }
        });
    }

    function canPlaceInSlot(slotIndex, number) {
        if (slots[slotIndex] !== null) return false;
        var leftBound = 0;
        for (var i = slotIndex - 1; i >= 1; i--) {
            if (slots[i] !== null) { leftBound = slots[i]; break; }
        }
        var rightBound = 101;
        for (var i = slotIndex + 1; i <= 10; i++) {
            if (slots[i] !== null) { rightBound = slots[i]; break; }
        }
        return number > leftBound && number < rightBound;
    }

    function updateSlotAvailability() {
        slotElements.forEach(function (slot) {
            var slotIndex = parseInt(slot.dataset.slot, 10);
            if (slots[slotIndex] !== null) {
                slot.classList.add('filled');
                slot.classList.remove('disabled');
            } else if (currentNumber !== null && canPlaceInSlot(slotIndex, currentNumber)) {
                slot.classList.remove('disabled', 'filled');
            } else {
                slot.classList.add('disabled');
                slot.classList.remove('filled');
            }
        });
    }

    function setMovableSlot(slotIndex) {
        slotElements.forEach(function (s) {
            s.classList.remove('movable');
            s.setAttribute('draggable', 'false');
        });
        if (slotIndex >= 1 && slotIndex <= 10) {
            var el = slotElements[slotIndex - 1];
            el.classList.add('movable');
            el.setAttribute('draggable', 'true');
        }
        currentMovableSlot = slotIndex;
    }

    function lockMovableSlot() {
        slotElements.forEach(function (s) {
            s.classList.remove('movable', 'drag-over', 'dragging', 'selected-move');
            s.setAttribute('draggable', 'false');
        });
        currentMovableSlot = null;
        dragSourceSlotIndex = null;
        tapMoveSource = null;
    }

    function placeNumber(slotIndex) {
        if (!gameActive || currentNumber === null) return;
        if (!canPlaceInSlot(slotIndex, currentNumber)) return;

        slots[slotIndex] = currentNumber;
        numbersPlaced++;
        var slotEl = slotElements[slotIndex - 1];
        var content = slotEl.querySelector('.slot-content');
        content.textContent = currentNumber;
        slotEl.classList.add('filled', 'win');
        setTimeout(function () { slotEl.classList.remove('win'); }, 500);

        currentNumber = null;
        currentNumberEl.textContent = '-';
        numbersPlacedEl.textContent = numbersPlaced;

        if (numbersPlaced === 10) {
            endGame(true);
            return;
        }

        nextNumberBtn.disabled = false;
        setMovableSlot(slotIndex);
        updateSlotAvailability();
    }

    function performMove(fromIndex, toIndex) {
        var n = slots[fromIndex];
        if (n === null) return;
        slots[fromIndex] = null;
        slots[toIndex] = n;
        var fromEl = slotElements[fromIndex - 1];
        var toEl = slotElements[toIndex - 1];
        fromEl.querySelector('.slot-content').textContent = '';
        fromEl.classList.remove('filled');
        toEl.querySelector('.slot-content').textContent = n;
        toEl.classList.add('filled');
        setMovableSlot(toIndex);
        updateSlotAvailability();
    }

    function showNextNumber() {
        if (!gameActive || numbersIndex >= numbers.length) return;
        lockMovableSlot();

        var num = numbers[numbersIndex];
        numbersIndex++;
        currentNumber = num;
        currentNumberEl.textContent = num;

        if (startTime === null) {
            startTime = Date.now();
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateTimer, 200);
        }

        nextNumberBtn.disabled = true;

        if (!canPlaceAnywhere(num)) {
            gameActive = false;
            setTimeout(function () { endGame(false); }, 1500);
            return;
        }
        updateSlotAvailability();
    }

    function canPlaceAnywhere(num) {
        for (var i = 1; i <= 10; i++) {
            if (canPlaceInSlot(i, num)) return true;
        }
        return false;
    }

    function updateTimer() {
        if (startTime === null) return;
        var elapsed = Math.floor((Date.now() - startTime) / 1000);
        timerDisplayEl.textContent = formatTime(elapsed);
    }

    function endGame(won) {
        gameActive = false;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        var completionSeconds = startTime !== null ? Math.floor((Date.now() - startTime) / 1000) : 0;

        finalScoreEl.textContent = numbersPlaced;
        completedSection.style.display = 'block';

        if (won) {
            gameOverTitleEl.textContent = 'You did it!';
            gameOverMessageEl.textContent = 'You placed all 10 numbers.';
            gameOverMessageEl.style.color = '#4caf50';
            completionTimeTextEl.textContent = formatTime(completionSeconds);
            if (completedSection) completedSection.style.display = 'block';

            Auth.getSession().then(function (session) {
                if (session && session.user) {
                    setLocalAttemptLock(session.user.id, getTodayDateUTC(), {
                        score: numbersPlaced,
                        completion_time_seconds: completionSeconds,
                        completed_at: new Date().toISOString()
                    });
                    leaderboardPromptEl.style.display = 'none';
                    submitAndShowLeaderboard(numbersPlaced, completionSeconds);
                } else {
                    leaderboardPromptEl.style.display = 'block';
                    if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'none';
                }
            });
        } else {
            gameOverTitleEl.textContent = 'Game over';
            gameOverMessageEl.textContent = 'The number couldn\'t be placed. You placed ' + numbersPlaced + ' numbers.';
            gameOverMessageEl.style.color = '#f44336';
            completionTimeTextEl.textContent = formatTime(completionSeconds);
            Auth.getSession().then(function (session) {
                if (session && session.user) {
                    setLocalAttemptLock(session.user.id, getTodayDateUTC(), {
                        score: numbersPlaced,
                        completion_time_seconds: completionSeconds,
                        completed_at: new Date().toISOString()
                    });
                    leaderboardPromptEl.style.display = 'none';
                    submitAndShowLeaderboard(numbersPlaced, completionSeconds);
                } else {
                    leaderboardPromptEl.style.display = 'block';
                    leaderboardContainerEl.style.display = 'none';
                }
            });
        }

        hideReplayButtonsIfPresent();
        showScreen('gameOverScreen');
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
                return client.from('daily_challenge_completions').select('user_id').eq('user_id', user.id).eq('date', dateStr).maybeSingle().then(function (existing) {
                    if (existing.data) {
                        return { skipped: true };
                    }
                    return client.from('daily_challenge_completions').insert({
                        user_id: user.id,
                        date: dateStr,
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
                updateStartStatusBanner(true, lastAttemptRecord);
                setTimeout(function () { loadLeaderboard(getTodayDateUTC()); }, 150);
                return;
            }
            if (res && res.error) {
                console.warn('Submit failed', res.error);
                hasCompletedTodayThisSession = true;
                lastAttemptRecord = { score: score, completion_time_seconds: completionTimeSeconds, completed_at: new Date().toISOString() };
                if (attemptLockUserId) setLocalAttemptLock(attemptLockUserId, getTodayDateUTC(), lastAttemptRecord);
                updateStartStatusBanner(true, lastAttemptRecord);
                if (leaderboardContainerEl) leaderboardContainerEl.style.display = 'block';
                if (leaderboardListEl) leaderboardListEl.innerHTML = '<tr><td colspan="4">Your result was not saved. Please check database migration/policies.</td></tr>';
                setTimeout(function () { loadLeaderboard(getTodayDateUTC()); }, 150);
                return;
            }
            hasCompletedTodayThisSession = true;
            lastAttemptRecord = { score: score, completion_time_seconds: completionTimeSeconds, completed_at: new Date().toISOString() };
            if (attemptLockUserId) setLocalAttemptLock(attemptLockUserId, getTodayDateUTC(), lastAttemptRecord);
            updateStartStatusBanner(true, lastAttemptRecord);
            setTimeout(function () { loadLeaderboard(getTodayDateUTC()); }, 150);
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
            .order('score', { ascending: false })
            .order('completion_time_seconds', { ascending: true })
            .then(function (res) {
                if (res.error) {
                    console.warn('Leaderboard failed', res.error);
                    var localOnlyRows = withLocalAttemptRecord([], dateStr);
                    leaderboardListEl.innerHTML = localOnlyRows.length ? renderRecordRows(localOnlyRows) : '<tr><td colspan="4">Could not load records right now.</td></tr>';
                    return;
                }
                leaderboardContainerEl.style.display = 'block';
                var mergedRows = withLocalAttemptRecord(res.data || [], dateStr);
                var html = renderRecordRows(mergedRows);
                leaderboardListEl.innerHTML = html || '<tr><td colspan="4">No records yet.</td></tr>';
            });
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function resetGame() {
        for (var i = 0; i <= 10; i++) slots[i] = null;
        currentNumber = null;
        numbersPlaced = 0;
        numbersIndex = 0;
        startTime = null;
        currentMovableSlot = null;
        dragSourceSlotIndex = null;
        tapMoveSource = null;
        touchDragSourceIndex = null;
        gameActive = true;

        slotElements.forEach(function (slot) {
            var content = slot.querySelector('.slot-content');
            content.textContent = '';
            slot.classList.remove('filled', 'disabled', 'win', 'movable', 'drag-over', 'dragging');
            slot.setAttribute('draggable', 'false');
        });

        currentNumberEl.textContent = '-';
        numbersPlacedEl.textContent = '0';
        timerDisplayEl.textContent = '0:00';
    }

    function startGame() {
        if (hasCompletedTodayThisSession) {
            showAlreadyCompletedView(lastAttemptRecord);
            return;
        }
        numbers = getTodaysNumbers();
        resetGame();
        showScreen('gameScreen');
        showNextNumber();
    }

    function init() {
        if (window.__JonesGamesAuthInit__) window.__JonesGamesAuthInit__();
        startScreen = getEl('startScreen');
        gameScreen = getEl('gameScreen');
        gameOverScreen = getEl('gameOverScreen');
        loginRequiredScreen = getEl('loginRequiredScreen');
        alreadyCompletedScreen = getEl('alreadyCompletedScreen');
        completeToSeeLeaderboardScreen = getEl('completeToSeeLeaderboardScreen');
        alreadyCompletedTimeEl = getEl('alreadyCompletedTime');
        alreadyCompletedLeaderboardListEl = getEl('alreadyCompletedLeaderboardList');
        adminResetControlsEl = getEl('adminResetControls');
        adminResetTodayBtnEl = getEl('adminResetTodayBtn');
        adminResetStatusEl = getEl('adminResetStatus');
        allScreens = [startScreen, gameScreen, gameOverScreen, loginRequiredScreen, alreadyCompletedScreen, completeToSeeLeaderboardScreen];
        startBtn = getEl('startBtn');
        nextNumberBtn = getEl('nextNumberBtn');
        dailyStatusBannerEl = getEl('dailyStatusBanner');
        hideReplayButtonsIfPresent();
        currentNumberEl = getEl('currentNumber');
        numbersPlacedEl = getEl('numbersPlaced');
        timerDisplayEl = getEl('timerDisplay');
        gameTitleEl = getEl('gameTitle');
        gameOverTitleEl = getEl('gameOverTitle');
        gameOverMessageEl = getEl('gameOverMessage');
        finalScoreEl = getEl('finalScore');
        completedSection = getEl('completedSection');
        completionTimeTextEl = getEl('completionTimeText');
        leaderboardPromptEl = getEl('leaderboardPrompt');
        leaderboardContainerEl = getEl('leaderboardContainer');
        leaderboardListEl = getEl('leaderboardList');

        var dateEl = getEl('dailyDate');
        if (dateEl) dateEl.textContent = 'Today: ' + formatDisplayDateUTC(getTodayDateUTC());

        var viewLeaderboard = typeof window !== 'undefined' && window.location && window.location.search && window.location.search.indexOf('view=leaderboard') !== -1;
        (window.__JonesGamesAuthInit__ ? window.__JonesGamesAuthInit__() : Promise.resolve()).then(function () {
            return checkDailyState();
        }).then(function (state) {
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
        }).then(function (state) {
            if (state.completedToday) {
                hasCompletedTodayThisSession = true;
                lastAttemptRecord = state.myCompletion || null;
                if (state.myCompletion && state.myCompletion.display_name) lastAttemptDisplayName = state.myCompletion.display_name;
            }
            applyView(state, viewLeaderboard);
        });

        var playChallengeLink = getEl('playChallengeFromLeaderboardLink');
        if (playChallengeLink) playChallengeLink.href = 'index.html?v=20260326f';

        startBtn.addEventListener('click', startGame);
        nextNumberBtn.addEventListener('click', showNextNumber);
        if (adminResetTodayBtnEl) adminResetTodayBtnEl.addEventListener('click', runAdminResetToday);
        slotElements = document.querySelectorAll('.slot');
        slotElements.forEach(function (slot) {
            slot.addEventListener('click', function (e) {
                if (!gameActive) return;
                var slotIndex = parseInt(slot.dataset.slot, 10);
                if (currentNumber !== null) {
                    placeNumber(slotIndex);
                    return;
                }
                if (currentMovableSlot !== null) {
                    if (slotIndex === currentMovableSlot) {
                        tapMoveSource = tapMoveSource === slotIndex ? null : slotIndex;
                        slotElements.forEach(function (s) { s.classList.remove('selected-move'); });
                        if (tapMoveSource) slot.classList.add('selected-move');
                        return;
                    }
                    if (tapMoveSource !== null && slots[slotIndex] === null && canPlaceInSlot(slotIndex, slots[tapMoveSource])) {
                        performMove(tapMoveSource, slotIndex);
                        tapMoveSource = null;
                        slotElements.forEach(function (s) { s.classList.remove('selected-move'); });
                    }
                }
            });

            slot.addEventListener('dragstart', function (e) {
                var slotIndex = parseInt(slot.dataset.slot, 10);
                if (slots[slotIndex] === null) return;
                dragSourceSlotIndex = slotIndex;
                slot.classList.add('dragging');
            });
            slot.addEventListener('dragover', function (e) {
                if (dragSourceSlotIndex === null) return;
                e.preventDefault();
                var slotIndex = parseInt(slot.dataset.slot, 10);
                if (slots[slotIndex] === null) slot.classList.add('drag-over');
            });
            slot.addEventListener('dragleave', function () { slot.classList.remove('drag-over'); });
            slot.addEventListener('drop', function (e) {
                if (dragSourceSlotIndex === null) return;
                e.preventDefault();
                var src = dragSourceSlotIndex;
                var tgt = parseInt(slot.dataset.slot, 10);
                slotElements.forEach(function (s) { s.classList.remove('drag-over', 'dragging'); });
                dragSourceSlotIndex = null;
                if (src !== tgt && slots[tgt] === null && slots[src] !== null) {
                    var n = slots[src];
                    slots[src] = null;
                    var canPlace = canPlaceInSlot(tgt, n);
                    slots[src] = n;
                    if (canPlace) performMove(src, tgt);
                }
            });
            slot.addEventListener('dragend', function () {
                dragSourceSlotIndex = null;
                slotElements.forEach(function (s) { s.classList.remove('drag-over', 'dragging'); });
            });

            slot.addEventListener('touchstart', function (e) {
                if (!gameActive) return;
                var slotIndex = parseInt(slot.dataset.slot, 10);
                if (slotIndex === currentMovableSlot && currentNumber === null) {
                    touchDragSourceIndex = slotIndex;
                    slot.classList.add('dragging');
                    e.preventDefault();
                }
            }, { passive: false });

            slot.addEventListener('touchmove', function (e) {
                if (touchDragSourceIndex === null) return;
                e.preventDefault();
                var touch = e.touches[0];
                var elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                slotElements.forEach(function (s) { s.classList.remove('drag-over'); });
                if (elementUnderTouch) {
                    var targetSlot = elementUnderTouch.closest('.slot');
                    if (targetSlot) {
                        var targetIndex = parseInt(targetSlot.dataset.slot, 10);
                        if (slots[targetIndex] === null && targetIndex !== touchDragSourceIndex) {
                            targetSlot.classList.add('drag-over');
                        }
                    }
                }
            }, { passive: false });

            slot.addEventListener('touchend', function (e) {
                if (touchDragSourceIndex === null) return;
                var sourceIndex = touchDragSourceIndex;
                touchDragSourceIndex = null;
                slotElements.forEach(function (s) { s.classList.remove('drag-over', 'dragging'); });
                var touch = e.changedTouches[0];
                var elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!elementUnderTouch) return;
                var targetSlot = elementUnderTouch.closest('.slot');
                if (!targetSlot) return;
                var targetIndex = parseInt(targetSlot.dataset.slot, 10);
                if (targetIndex === sourceIndex || slots[targetIndex] !== null) return;
                var number = slots[sourceIndex];
                if (number === null) return;
                slots[sourceIndex] = null;
                var canPlace = canPlaceInSlot(targetIndex, number);
                slots[sourceIndex] = number;
                if (canPlace) performMove(sourceIndex, targetIndex);
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
