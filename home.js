// Home page logic for game hub
document.addEventListener('DOMContentLoaded', () => {
    const gamesContainer = document.getElementById('gamesContainer');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    
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
        
        return `
            <a href="${game.folder}/index.html" class="game-card ${featuredClass}" data-game-id="${game.id}" style="--card-color: ${cardColor}">
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
