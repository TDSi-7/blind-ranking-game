document.addEventListener('DOMContentLoaded', function () {
    var Auth = window.JonesGamesAuth;
    var Sync = window.JonesGamesSync;
    var loginNote = document.getElementById('myStatsLoginNote');
    var content = document.getElementById('myStatsContent');

    function formatNumber(value) {
        var n = Number(value || 0);
        return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function renderLoggedOut() {
        if (loginNote) loginNote.style.display = 'block';
        if (content) content.innerHTML = 'Log in to view your personal records.';
    }

    function renderStats(stats) {
        if (!content) return;
        if (!stats) {
            content.innerHTML = 'No account stats yet. Play a game to populate your profile.';
            return;
        }
        var blind = stats.blind_ranking || {};
        var blindDiff = blind.difficulty || {};
        var daily = stats.daily_challenge || {};
        var gamesList = (stats.games_played_games || []).map(escapeHtml).join(', ') || 'None yet';

        content.innerHTML = [
            '<div class="kid-stats-grid">',
            '<article class="kid-stat-card"><h3>🎮 Games Played</h3><p class="kid-stat-number">' + formatNumber(stats.games_played_total) + '</p></article>',
            '<article class="kid-stat-card"><h3>📈 Average Score</h3><p class="kid-stat-number">' + formatNumber(blind.overall_average_score) + '</p></article>',
            '<article class="kid-stat-card"><h3>🏆 Best Score</h3><p class="kid-stat-number">' + formatNumber(blind.overall_high_score) + '</p></article>',
            '<article class="kid-stat-card"><h3>🥇 1st Places</h3><p class="kid-stat-number">' + formatNumber(daily.first_count) + '</p></article>',
            '<article class="kid-stat-card"><h3>🥈 2nd Places</h3><p class="kid-stat-number">' + formatNumber(daily.second_count) + '</p></article>',
            '<article class="kid-stat-card"><h3>🥉 3rd Places</h3><p class="kid-stat-number">' + formatNumber(daily.third_count) + '</p></article>',
            '</div>',
            '<p class="my-stat-line"><strong>Games you've tried:</strong> ' + gamesList + '</p>',
            '<p class="my-stat-line"><strong>Daily average position:</strong> ' + formatNumber(daily.average_position) + '</p>',
            '<p class="my-stat-line"><strong>Blind Ranking highs (Easy / Medium / Hard):</strong> ' +
                formatNumber((((blind.high_scores || {}).easy || {}).highScore)) + ' / ' +
                formatNumber((((blind.high_scores || {}).medium || {}).highScore)) + ' / ' +
                formatNumber((((blind.high_scores || {}).hard || {}).highScore)) + '</p>',
            '<p class="my-stat-line"><strong>Blind Ranking averages (Easy / Medium / Hard):</strong> ' +
                formatNumber((((blindDiff.easy || {}).averageScore))) + ' / ' +
                formatNumber((((blindDiff.medium || {}).averageScore))) + ' / ' +
                formatNumber((((blindDiff.hard || {}).averageScore))) + '</p>'
        ].join('');
    }

    function load() {
        if (!Auth || !Sync || !Sync.getMyAccountStats) {
            renderLoggedOut();
            return;
        }
        (window.__JonesGamesAuthInit__ ? window.__JonesGamesAuthInit__() : Promise.resolve())
            .then(function () { return Auth.getSession(); })
            .then(function (session) {
                if (!session || !session.user) {
                    renderLoggedOut();
                    return;
                }
                if (loginNote) loginNote.style.display = 'none';
                return Sync.getMyAccountStats().then(renderStats).catch(function () {
                    if (content) content.innerHTML = 'Could not load your stats right now.';
                });
            })
            .catch(renderLoggedOut);
    }

    load();
});
