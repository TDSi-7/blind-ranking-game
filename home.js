document.addEventListener('DOMContentLoaded', function () {
    var gamesContainer = document.getElementById('gamesContainer');
    var loadingMessage = document.getElementById('loadingMessage');
    var errorMessage = document.getElementById('errorMessage');
    var authSection = document.getElementById('authSection');
    var authActionBtn = document.getElementById('authActionBtn');
    var authUserHint = document.getElementById('authUserHint');
    var authNote = document.getElementById('authNote');

    var Auth = window.JonesGamesAuth;
    var DAILY_CHALLENGE_ASSET_VERSION = '20260326k';
    var isLoggedIn = false;

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function getGameUrl(game) {
        if (game && game.id === 'daily-challenge') {
            return game.folder + '/index.html?v=' + DAILY_CHALLENGE_ASSET_VERSION;
        }
        return game.folder + '/index.html';
    }

    function renderAuth(session) {
        if (!authSection || !authActionBtn) return;
        authSection.style.display = 'flex';
        isLoggedIn = !!(session && session.user);
        if (isLoggedIn) {
            var meta = session.user.user_metadata || {};
            var name = meta.full_name || meta.name || session.user.email || 'Player';
            authActionBtn.textContent = 'Logout';
            authActionBtn.style.display = 'inline-flex';
            if (authUserHint) {
                authUserHint.textContent = 'Logged in as ' + name;
                authUserHint.style.display = 'inline-block';
            }
            if (authNote) authNote.style.display = 'none';
            if (window.JonesGamesSync && window.JonesGamesSync.syncWithServer) {
                window.JonesGamesSync.syncWithServer();
            }
        } else {
            authActionBtn.textContent = 'Login';
            authActionBtn.style.display = Auth && Auth.isConfigured && Auth.isConfigured() ? 'inline-flex' : 'none';
            if (authUserHint) {
                authUserHint.textContent = '';
                authUserHint.style.display = 'none';
            }
            if (authNote) authNote.style.display = Auth && Auth.isConfigured && Auth.isConfigured() ? 'block' : 'none';
        }
    }

    function normalizeCreator(value) {
        return String(value || '').trim().toLowerCase();
    }

    function partitionGames(games) {
        var sections = {
            alex: [],
            mimi: [],
            daily: []
        };

        (games || []).forEach(function (game) {
            if (game.id === 'daily-challenge') {
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
            if (creator.indexOf('daily') >= 0) {
                sections.daily.push(game);
                return;
            }
            sections.alex.push(game);
        });
        return sections;
    }

    function buildRail(title, sectionClass, games) {
        var cards = (games || []).map(function (game) {
            return createGameCard(game);
        }).join('');
        if (!cards) {
            cards = '<p class="empty-rail-note">More games coming soon.</p>';
        }
        return '<section class="game-rail-section ' + sectionClass + '">' +
            '<h2 class="rail-title">' + escapeHtml(title) + '</h2>' +
            '<div class="game-rail" role="region" aria-label="' + escapeHtml(title) + '">' + cards + '</div>' +
            '</section>';
    }

    function renderGames(games) {
        if (!gamesContainer) return;
        if (!games || games.length === 0) {
            gamesContainer.innerHTML = '<p class="empty-rail-note">No games available yet. Check back soon.</p>';
            return;
        }
        var grouped = partitionGames(games);
        gamesContainer.innerHTML = [
            buildRail('Games by Alex', 'rail-alex', grouped.alex),
            buildRail('Games by Mimi', 'rail-mimi', grouped.mimi),
            buildRail('Daily Challenges', 'rail-daily', grouped.daily)
        ].join('');
    }

    function createGameCard(game) {
        var difficultyBadges = (game.difficultyLevels || []).map(function (level) {
            var levelLower = String(level || '').toLowerCase();
            return '<span class="difficulty-badge ' + levelLower + '">' + escapeHtml(level) + '</span>';
        }).join('');
        if (game.freePlay) {
            difficultyBadges = '<span class="difficulty-badge free-play">Free Play</span>' + difficultyBadges;
        } else if (game.id === 'daily-challenge') {
            difficultyBadges = '<span class="difficulty-badge daily">Daily</span>' + difficultyBadges;
        }
        var cardColor = game.color || '#2196F3';
        return '<a href="' + getGameUrl(game) + '" class="game-card" style="--card-color: ' + cardColor + '">' +
            '<div class="game-icon">' + (game.icon || '🎮') + '</div>' +
            '<h3 class="game-name">' + escapeHtml(game.name) + '</h3>' +
            '<p class="game-description">' + escapeHtml(game.description) + '</p>' +
            '<div class="game-meta">' +
            '<span class="game-age-range">Ages ' + escapeHtml(game.ageRange || '') + '</span>' +
            '<div class="game-difficulties">' + difficultyBadges + '</div>' +
            '</div>' +
            '</a>';
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

    if (Auth) {
        (window.__JonesGamesAuthInit__ || (function () { return Promise.resolve(); }))()
            .then(function () { return Auth.getSession(); })
            .then(function (session) { renderAuth(session || null); })
            .catch(function () { renderAuth(null); });
        Auth.onAuthStateChange(function (session) {
            renderAuth(session || null);
        });
    }

    fetch('games.json')
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to load games');
            return response.json();
        })
        .then(function (data) {
            if (loadingMessage) loadingMessage.style.display = 'none';
            renderGames(data.games || []);
        })
        .catch(function (error) {
            console.error('Error loading games:', error);
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (errorMessage) errorMessage.style.display = 'block';
        });
});
