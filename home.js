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

    const Hub = window.FunGamesHubProfiles;
    if (!Hub) {
        console.error('FunGamesHubProfiles not loaded');
    } else {
        Hub.ensureCurrentProfile();
        renderProfileSelect();
        renderStatsSummary();
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
                    window.location.href = `${game.folder}/index.html`;
                });
            }
        });
    }

    function createGameCard(game) {
        const difficultyBadges = game.difficultyLevels.map(level => {
            const levelLower = level.toLowerCase();
            return `<span class="difficulty-badge ${levelLower}">${level}</span>`;
        }).join('');

        const featuredClass = game.featured ? 'featured' : '';
        const cardColor = game.color || '#2196F3';
        const creatorTag = game.creator ? `<div class="creator-tag" style="--creator-accent: ${cardColor}">By ${game.creator}</div>` : '';

        return `
            <a href="${game.folder}/index.html" class="game-card ${featuredClass}" data-game-id="${game.id}" style="--card-color: ${cardColor}">
                ${creatorTag}
                <div class="game-icon">${game.icon || '🎮'}</div>
                <h2 class="game-name">${game.name}</h2>
                <p class="game-description">${game.description}</p>
                <div class="game-meta">
                    <span class="game-age-range">Ages ${game.ageRange}</span>
                    <div class="game-difficulties">
                        ${difficultyBadges}
                    </div>
                </div>
            </a>
        `;
    }
});
