document.addEventListener('DOMContentLoaded', function () {
    var gamesContainer = document.getElementById('gamesContainer');
    var loadingMessage = document.getElementById('loadingMessage');
    var errorMessage = document.getElementById('errorMessage');
    var authSection = document.getElementById('authSection');
    var authActionBtn = document.getElementById('authActionBtn');
    var nicknameBtn = document.getElementById('nicknameBtn');
    var authUserHint = document.getElementById('authUserHint');
    var authNote = document.getElementById('authNote');
    var nicknameModal = document.getElementById('nicknameModal');
    var nicknameInput = document.getElementById('nicknameInput');
    var nicknameSaveBtn = document.getElementById('nicknameSaveBtn');
    var nicknameCloseBtn = document.getElementById('nicknameCloseBtn');
    var nicknameBackdrop = nicknameModal ? nicknameModal.querySelector('.settings-modal-backdrop') : null;

    var Auth = window.JonesGamesAuth;
    var DAILY_CHALLENGE_ASSET_VERSION = '20260406hof';
    /** Bump when games.json changes so CDN/browsers fetch the new catalog. */
    var GAMES_CATALOG_VERSION = '20260611tm';
    var isLoggedIn = false;
    var currentUserId = null;
    var loadedGames = null;

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function getGameUrl(game) {
        if (game && (game.dailyChallenge || game.id === 'daily-challenge')) {
            return game.folder + '/index.html?v=' + DAILY_CHALLENGE_ASSET_VERSION;
        }
        return game.folder + '/index.html';
    }

    function renderAuth(session) {
        if (!authSection || !authActionBtn) return;
        authSection.style.display = 'flex';
        isLoggedIn = !!(session && session.user);
        currentUserId = isLoggedIn ? session.user.id : null;
        if (isLoggedIn) {
            var meta = session.user.user_metadata || {};
            var name = meta.full_name || meta.name || session.user.email || 'Player';
            authActionBtn.textContent = 'Sign out';
            authActionBtn.style.display = 'inline-flex';
            if (nicknameBtn) nicknameBtn.style.display = 'inline-flex';
            if (authUserHint) {
                authUserHint.textContent = name;
                authUserHint.style.display = 'inline';
            }
            if (authNote) authNote.style.display = 'none';
            if (window.JonesGamesSync && window.JonesGamesSync.syncWithServer) {
                window.JonesGamesSync.syncWithServer().then(function () {
                    if (window.JonesGamesSync.getProfile && authUserHint) {
                        window.JonesGamesSync.getProfile().then(function (profile) {
                            if (profile && profile.display_name) {
                                authUserHint.textContent = profile.display_name;
                            }
                        });
                    }
                });
            }
        } else {
            authActionBtn.textContent = 'Sign in with Google';
            authActionBtn.style.display = Auth && Auth.isConfigured && Auth.isConfigured() ? 'inline-flex' : 'none';
            if (nicknameBtn) nicknameBtn.style.display = 'none';
            if (authUserHint) {
                authUserHint.textContent = '';
                authUserHint.style.display = 'none';
            }
            if (authNote) authNote.style.display = Auth && Auth.isConfigured && Auth.isConfigured() ? 'block' : 'none';
        }
    }

    function openNicknameModal() {
        if (!isLoggedIn || !nicknameModal || !nicknameInput) return;
        nicknameModal.style.display = 'flex';
        if (window.JonesGamesSync && window.JonesGamesSync.getProfile) {
            window.JonesGamesSync.getProfile().then(function (profile) {
                nicknameInput.value = profile && profile.display_name ? profile.display_name : '';
                nicknameInput.focus();
                nicknameInput.select();
            });
            return;
        }
        nicknameInput.value = '';
        nicknameInput.focus();
    }

    function closeNicknameModal() {
        if (nicknameModal) nicknameModal.style.display = 'none';
    }

    function saveNickname() {
        if (!isLoggedIn || !window.JonesGamesSync || !window.JonesGamesSync.updateProfile) return;
        var nickname = nicknameInput ? nicknameInput.value.trim() : '';
        window.JonesGamesSync.updateProfile({ display_name: nickname || 'Player' })
            .then(function () {
                if (authUserHint) authUserHint.textContent = nickname || 'Player';
                closeNicknameModal();
            })
            .catch(function (err) {
                console.error('Nickname update failed', err);
                alert('Could not save nickname. Please try again.');
            });
    }

    function normalizeCreator(value) {
        return String(value || '').trim().toLowerCase();
    }

    function partitionGames(games) {
        var sections = {
            alex: [],
            mimi: [],
            simon: [],
            daily: []
        };

        (games || []).forEach(function (game) {
            if (game.dailyChallenge || game.id === 'daily-challenge') {
                sections.daily.push(game);
                return;
            }
            var creator = normalizeCreator(game.creator);
            if (creator === 'alex') {
                sections.alex.push(game);
                return;
            }
            if (creator === 'mimi') {
                sections.mimi.push(game);
                return;
            }
            if (creator === 'simon') {
                sections.simon.push(game);
                return;
            }
            if (creator.indexOf('daily') >= 0) {
                sections.daily.push(game);
                return;
            }
            sections.alex.push(game);
        });
        return sections;
    }

    var CHALLENGE_IDS = {
        'daily-challenge': 'blind_ranking',
        'daily-higher-or-lower': 'higher_or_lower',
        'daily-codebreaker': 'codebreaker'
    };

    var DAILY_TITLES = {
        'daily-challenge': 'Blind Rank',
        'daily-higher-or-lower': 'Higher or Lower',
        'daily-codebreaker': 'Codebreaker'
    };

    function todayLabel() {
        var Seed = window.JonesGamesDailySeed;
        if (Seed && Seed.getTodayDateUTC && Seed.formatDisplayDateUTC) {
            return Seed.formatDisplayDateUTC(Seed.getTodayDateUTC());
        }
        return '';
    }

    function playedToday(game) {
        var challengeId = CHALLENGE_IDS[game.id];
        if (!currentUserId || !challengeId || !window.JonesGamesDailySeed) return false;
        var today = window.JonesGamesDailySeed.getTodayDateUTC();
        try {
            var map = JSON.parse(localStorage.getItem('daily_challenge_attempt_lock_v2') || '{}');
            return !!(map[currentUserId] && map[currentUserId][challengeId] && map[currentUserId][challengeId][today]);
        } catch (e) {
            return false;
        }
    }

    function markFor(game) {
        var id = game.id || '';
        if (id === 'daily-challenge' || id === 'blind-ranking') return { tone: 'blue', html: '1–10' };
        if (id.indexOf('higher') >= 0) return { tone: 'teal', html: 'A♠' };
        if (id.indexOf('code') >= 0) return { tone: 'violet', html: '<span class="hub-dots"><i></i><i></i><i></i><i></i></span>' };
        if (id.indexOf('player') >= 0 || id.indexOf('lfc') >= 0) return { tone: 'red', html: 'CF' };
        if (id.indexOf('chess') >= 0 || id.indexOf('mimi') >= 0) return { tone: 'amber', html: '<svg viewBox="0 0 46 54" aria-hidden="true"><circle cx="23" cy="12" r="8" fill="#fff"/><path fill="#fff" d="M14 26c2-6 16-6 18 0 3 2 6 6 6 10H8c0-4 3-8 6-10z"/><rect x="8" y="44" width="30" height="6" rx="2" fill="#fff"/></svg>' };
        return { tone: 'blue', html: escapeHtml((game.name || 'G').charAt(0)) };
    }

    function difficultyLine(game) {
        var levels = game.difficultyLevels || [];
        if (!levels.length) return '';
        return levels.join(', ');
    }

    function renderGames(games) {
        if (!gamesContainer) return;
        if (!games || games.length === 0) {
            gamesContainer.innerHTML = '<p class="hub-empty">No games available yet. Check back soon.</p>';
            return;
        }
        var grouped = partitionGames(games);
        var html = '';
        if (grouped.daily.length) {
            html += '<section class="hub-block">' +
                '<p class="hub-date">' + escapeHtml(todayLabel()) + '</p>' +
                '<h1>Today</h1>' +
                '<p class="hub-lede">The same puzzles for everyone.</p>' +
                '<div class="hub-today">' + grouped.daily.map(createDailyCard).join('') + '</div>' +
                '</section>';
        }
        var practice = '';
        if (grouped.alex.length) {
            practice += '<h3 class="hub-creator">Alex</h3><div class="hub-shelf">' + grouped.alex.map(createPlayCard).join('') + '</div>';
        }
        if (grouped.mimi.length) {
            practice += '<h3 class="hub-creator">Mimi</h3><div class="hub-shelf">' + grouped.mimi.map(createPlayCard).join('') + '</div>';
        }
        if (practice) {
            html += '<section class="hub-block"><h2>Play anytime</h2><p class="hub-lede">Practice whenever you like. Pick a difficulty inside. No account needed.</p>' + practice + '</section>';
        }
        if (grouped.simon.length) {
            html += '<section class="hub-block"><h2>On now</h2>' + grouped.simon.map(createEventCard).join('') + '</section>';
        }
        gamesContainer.innerHTML = html;
    }

    function createDailyCard(game) {
        var mark = markFor(game);
        var done = playedToday(game);
        var title = DAILY_TITLES[game.id] || game.name;
        return '<a class="hub-ticket" href="' + getGameUrl(game) + '">' +
            '<span class="hub-ticket-top"><span class="hub-icon hub-icon-' + mark.tone + '">' + mark.html + '</span>' +
            '<span class="hub-status ' + (done ? 'is-done' : 'is-open') + '">' + (done ? 'Played' : 'Still open') + '</span></span>' +
            '<h3>' + escapeHtml(title) + '</h3>' +
            '<p>' + escapeHtml(game.description || '') + '</p>' +
            '<span class="hub-play' + (done ? ' is-quiet' : '') + '">' + (done ? 'See result' : 'Play') + '</span>' +
            '</a>';
    }

    function createPlayCard(game) {
        var mark = markFor(game);
        var meta = difficultyLine(game);
        return '<a class="hub-game" href="' + getGameUrl(game) + '">' +
            '<span class="hub-icon hub-icon-' + mark.tone + '">' + mark.html + '</span>' +
            '<span class="hub-game-copy"><h3>' + escapeHtml(game.name) + '</h3>' +
            '<p>' + escapeHtml(game.description || '') + '</p>' +
            (meta ? '<span class="hub-meta">' + escapeHtml(meta) + '</span>' : '') +
            '</span></a>';
    }

    function createEventCard(game) {
        return '<a class="hub-event" href="' + getGameUrl(game) + '">' +
            '<span><h3>' + escapeHtml(game.name) + '</h3><p>' + escapeHtml(game.description || '') + '</p></span>' +
            '<span class="hub-play">Enter</span></a>';
    }

    if (authActionBtn) {
        authActionBtn.addEventListener('click', function () {
            if (!Auth || !Auth.isConfigured || !Auth.isConfigured()) return;
            if (isLoggedIn) {
                Auth.signOut();
                return;
            }
            Auth.signInWithGoogle().catch(function (err) {
                console.error('Sign in failed', err);
                alert('Sign in failed. Please try again.');
            });
        });
    }
    if (nicknameBtn) nicknameBtn.addEventListener('click', openNicknameModal);
    if (nicknameSaveBtn) nicknameSaveBtn.addEventListener('click', saveNickname);
    if (nicknameCloseBtn) nicknameCloseBtn.addEventListener('click', closeNicknameModal);
    if (nicknameBackdrop) nicknameBackdrop.addEventListener('click', closeNicknameModal);

    if (Auth) {
        (window.__JonesGamesAuthInit__ || (function () { return Promise.resolve(); }))()
            .then(function () { return Auth.getSession(); })
            .then(function (session) {
                renderAuth(session || null);
                if (loadedGames) renderGames(loadedGames);
            })
            .catch(function () { renderAuth(null); });
        Auth.onAuthStateChange(function (session) {
            renderAuth(session || null);
            if (loadedGames) renderGames(loadedGames);
        });
    }

    fetch('games.json?v=' + encodeURIComponent(GAMES_CATALOG_VERSION))
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to load games');
            return response.json();
        })
        .then(function (data) {
            if (loadingMessage) loadingMessage.style.display = 'none';
            loadedGames = data.games || [];
            renderGames(loadedGames);
        })
        .catch(function (error) {
            console.error('Error loading games:', error);
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (errorMessage) errorMessage.style.display = 'block';
        });
});
