// Home page logic for game hub
document.addEventListener('DOMContentLoaded', () => {
    const gamesContainer = document.getElementById('gamesContainer');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const profileSelect = document.getElementById('profileSelect');
    const createProfileBtn = document.getElementById('createProfileBtn');
    const createProfileForm = document.getElementById('createProfileForm');
    const newProfileName = document.getElementById('newProfileName');
    const saveNewProfileBtn = document.getElementById('saveNewProfileBtn');
    const cancelNewProfileBtn = document.getElementById('cancelNewProfileBtn');
    const statsSummary = document.getElementById('statsSummary');
    const statsSummaryContent = document.getElementById('statsSummaryContent');
    const authSection = document.getElementById('authSection');
    const authGuest = document.getElementById('authGuest');
    const authLoggedIn = document.getElementById('authLoggedIn');
    const signInWithGoogleBtn = document.getElementById('signInWithGoogleBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const authAvatar = document.getElementById('authAvatar');
    const authDisplayName = document.getElementById('authDisplayName');
    const profileSection = document.getElementById('profileSection');
    const authNote = document.getElementById('authNote');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsNickname = document.getElementById('settingsNickname');
    const settingsSaveBtn = document.getElementById('settingsSaveBtn');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingsModalBackdrop = settingsModal && settingsModal.querySelector('.settings-modal-backdrop');

    const Hub = window.FunGamesHubProfiles;
    const Auth = window.JonesGamesAuth;
    const DAILY_CHALLENGE_ASSET_VERSION = '20260326f';
    function getGameUrl(game) {
        if (game && game.id === 'daily-challenge') {
            return game.folder + '/index.html?v=' + DAILY_CHALLENGE_ASSET_VERSION;
        }
        return game.folder + '/index.html';
    }


    if (!Hub) {
        console.error('FunGamesHubProfiles not loaded');
    } else {
        Hub.ensureCurrentProfile();
        renderProfileSelect();
        renderStatsSummary();
    }

    function setDisplayName(name) {
        if (authDisplayName) authDisplayName.textContent = name || 'Player';
    }

    function renderAuth(session) {
        if (!authSection || !authGuest || !authLoggedIn) return;
        authSection.style.display = 'block';
        if (session && session.user) {
            authGuest.style.display = 'none';
            authLoggedIn.style.display = 'flex';
            if (profileSection) profileSection.style.display = 'none';
            var u = session.user.user_metadata || {};
            var fallbackName = u.full_name || u.name || session.user.email || 'Player';
            if (authAvatar) {
                authAvatar.src = u.avatar_url || u.picture || '';
                authAvatar.alt = fallbackName;
                authAvatar.style.display = (u.avatar_url || u.picture) ? '' : 'none';
            }
            setDisplayName(fallbackName);
            if (authNote) authNote.style.display = 'none';
            if (window.JonesGamesSync) {
                if (window.JonesGamesSync.syncWithServer) {
                    window.JonesGamesSync.syncWithServer().then(function () {
                        if (Hub) renderStatsSummary();
                    });
                }
                if (window.JonesGamesSync.getProfile) {
                    window.JonesGamesSync.getProfile().then(function (profile) {
                        if (profile && profile.display_name) setDisplayName(profile.display_name);
                    });
                }
            }
        } else {
            authLoggedIn.style.display = 'none';
            authGuest.style.display = 'flex';
            if (profileSection) profileSection.style.display = 'block';
            if (signInWithGoogleBtn) signInWithGoogleBtn.style.display = Auth && Auth.isConfigured() ? 'inline-flex' : 'none';
            if (authNote) authNote.style.display = Auth && Auth.isConfigured() ? 'block' : 'none';
        }
    }

    function openSettingsModal() {
        if (!settingsModal || !settingsNickname) return;
        settingsModal.style.display = 'flex';
        if (window.JonesGamesSync && window.JonesGamesSync.getProfile) {
            window.JonesGamesSync.getProfile().then(function (profile) {
                settingsNickname.value = (profile && profile.display_name) ? profile.display_name : '';
                settingsNickname.focus();
            });
        } else {
            settingsNickname.value = '';
            settingsNickname.focus();
        }
    }

    function closeSettingsModal() {
        if (settingsModal) settingsModal.style.display = 'none';
    }

    function saveSettings() {
        var nickname = settingsNickname && settingsNickname.value.trim();
        if (!window.JonesGamesSync || !window.JonesGamesSync.updateProfile) return;
        window.JonesGamesSync.updateProfile({ display_name: nickname || 'Player' }).then(function () {
            setDisplayName(nickname || 'Player');
            closeSettingsModal();
        }).catch(function (err) {
            console.error('Settings save failed', err);
            alert('Could not save. Please try again.');
        });
    }

    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    if (settingsSaveBtn) settingsSaveBtn.addEventListener('click', saveSettings);
    if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal);
    if (settingsModalBackdrop) settingsModalBackdrop.addEventListener('click', closeSettingsModal);

    if (Auth) {
        (window.__JonesGamesAuthInit__ || (function () { return Promise.resolve(); }))()
            .then(function () { return Auth.getSession(); })
            .then(function (session) {
                renderAuth(session ? session : null);
            })
            .catch(function () { renderAuth(null); });
        Auth.onAuthStateChange(function (session) {
            renderAuth(session || null);
        });
    }

    if (signInWithGoogleBtn) {
        signInWithGoogleBtn.addEventListener('click', function () {
            if (!Auth || !Auth.isConfigured()) return;
            Auth.signInWithGoogle().catch(function (err) {
                console.error('Sign in failed', err);
                alert('Sign in failed. Please try again.');
            });
        });
    }
    if (signOutBtn) {
        signOutBtn.addEventListener('click', function () {
            if (Auth) Auth.signOut();
        });
    }

    function renderProfileSelect() {
        if (!profileSelect || !Hub) return;
        const profiles = Hub.getProfiles();
        const currentId = Hub.getCurrentProfileId();
        profileSelect.innerHTML = profiles.map(p => {
            const selected = p.id === currentId ? ' selected' : '';
            return `<option value="${p.id}"${selected}>${escapeHtml(p.name)}</option>`;
        }).join('');
    }

    if (profileSelect) {
        profileSelect.addEventListener('change', () => {
            if (Hub) {
                Hub.setCurrentProfileId(profileSelect.value);
                renderStatsSummary();
            }
        });
    }

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    createProfileBtn.addEventListener('click', () => {
        createProfileForm.style.display = 'flex';
        newProfileName.value = '';
        newProfileName.focus();
    });
    cancelNewProfileBtn.addEventListener('click', () => {
        createProfileForm.style.display = 'none';
    });
    saveNewProfileBtn.addEventListener('click', () => {
        const name = newProfileName.value.trim() || 'Player';
        Hub.createProfile(name);
        createProfileForm.style.display = 'none';
        renderProfileSelect();
        renderStatsSummary();
    });

    function renderStatsSummary() {
        if (!statsSummary || !statsSummaryContent || !Hub) return;
        const profileId = Hub.getCurrentProfileId();
        if (!profileId) {
            statsSummary.style.display = 'none';
            return;
        }
        const stats = Hub.getStats(profileId);
        const gameIds = Object.keys(stats);
        if (gameIds.length === 0) {
            statsSummary.style.display = 'none';
            return;
        }
        statsSummary.style.display = 'block';
        const lines = [];
        if (stats['blind-ranking']) {
            const br = stats['blind-ranking'];
            const hs = br.highScores || {};
            const best = [hs.easy, hs.medium, hs.hard].filter(Boolean).map(d => d.highScore).reduce((a, b) => Math.max(a, b || 0), 0);
            const perfects = [hs.easy, hs.medium, hs.hard].filter(Boolean).reduce((n, d) => n + (d.perfectGames || 0), 0);
            lines.push(`Blind Ranking: Best ${best > 0 ? best : '-'}, Perfect 10/10s: ${perfects}`);
        }
        if (stats['mimi-memory-chess']) {
            const mmc = stats['mimi-memory-chess'];
            const wins = mmc.wins || 0;
            const played = mmc.gamesPlayed || 0;
            lines.push(`Mimi's Memory Chess: ${wins} wins${played ? ` (${played} played)` : ''}`);
        }
        statsSummaryContent.innerHTML = lines.length ? lines.map(l => `<p class="stats-line">${l}</p>`).join('') : '<p class="stats-line">No stats yet. Play a game!</p>';
    }

    // Fetch games from games.json
    fetch('games.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load games');
            }
            return response.json();
        })
        .then(data => {
            loadingMessage.style.display = 'none';
            renderGames(data.games);
        })
        .catch(error => {
            console.error('Error loading games:', error);
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
        });

    function renderGames(games) {
        if (!games || games.length === 0) {
            gamesContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #666; font-size: 1.2em;">No games available yet. Check back soon!</p>';
            return;
        }

        gamesContainer.innerHTML = games.map(game => createGameCard(game)).join('');

        // Add click handlers to game cards
        games.forEach(game => {
            const card = document.querySelector(`[data-game-id="${game.id}"]`);
            if (card) {
                card.addEventListener('click', () => {
                    window.location.href = getGameUrl(game);
                });
            }
        });
    }

    function createGameCard(game) {
        var difficultyBadges = (game.difficultyLevels || []).map(function (level) {
            var levelLower = level.toLowerCase();
            return '<span class="difficulty-badge ' + levelLower + '">' + level + '</span>';
        }).join('');
        if (game.freePlay) {
            difficultyBadges = '<span class="difficulty-badge free-play">Free Play</span>' + difficultyBadges;
        } else if (game.id === 'daily-challenge') {
            difficultyBadges = '<span class="difficulty-badge daily">Daily</span>' + difficultyBadges;
        }

        var featuredClass = game.featured ? 'featured' : '';
        var cardColor = game.color || '#2196F3';
        var creatorTag = game.creator ? '<div class="creator-tag" style="--creator-accent: ' + cardColor + '">By ' + escapeHtml(game.creator) + '</div>' : '';

        return '<a href="' + getGameUrl(game) + '" class="game-card ' + featuredClass + '" data-game-id="' + game.id + '" style="--card-color: ' + cardColor + '">' +
            creatorTag +
            '<div class="game-icon">' + (game.icon || '🎮') + '</div>' +
            '<h2 class="game-name">' + escapeHtml(game.name) + '</h2>' +
            '<p class="game-description">' + escapeHtml(game.description) + '</p>' +
            '<div class="game-meta">' +
            '<span class="game-age-range">Ages ' + escapeHtml(game.ageRange || '') + '</span>' +
            '<div class="game-difficulties">' + difficultyBadges + '</div>' +
            '</div></a>';
    }
});
