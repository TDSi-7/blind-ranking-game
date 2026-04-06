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

    function renderDailyChallengeBlock(title, d) {
        var o = d || {};
        return (
            '<article class="kid-stat-card kid-stat-card--daily">' +
            '<h3>' + escapeHtml(title) + '</h3>' +
            '<div class="kid-stats-grid kid-stats-grid--nested">' +
            '<p class="kid-stat-inline"><strong>Played:</strong> ' + formatNumber(o.challenges_played) + '</p>' +
            '<p class="kid-stat-inline"><strong>Points:</strong> ' + formatNumber(o.points) + '</p>' +
            '<p class="kid-stat-inline"><strong>1st / 2nd / 3rd:</strong> ' +
            formatNumber(o.first_count) + ' / ' + formatNumber(o.second_count) + ' / ' + formatNumber(o.third_count) + '</p>' +
            '<p class="kid-stat-inline"><strong>Avg position:</strong> ' + formatNumber(o.average_position) + '</p>' +
            '</div></article>'
        );
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
        var dc = stats.daily_challenges || {};
        var brDaily = dc.blind_ranking || stats.daily_challenge || {};
        var holDaily = dc.higher_or_lower || {};
        var cbDaily = dc.codebreaker || {};
        var gamesRaw = stats.games_played_games;
        var gamesArray = Array.isArray(gamesRaw) ? gamesRaw : (gamesRaw ? [gamesRaw] : []);
        var gamesList = gamesArray.map(function (item) {
            return escapeHtml(String(item || ''));
        }).join(', ') || 'None yet';

        content.innerHTML = [
            '<div class="kid-stats-grid">',
            '<article class="kid-stat-card"><h3>🎮 Games Played</h3><p class="kid-stat-number">' + formatNumber(stats.games_played_total) + '</p></article>',
            '<article class="kid-stat-card"><h3>📈 Average Score</h3><p class="kid-stat-number">' + formatNumber(blind.overall_average_score) + '</p></article>',
            '<article class="kid-stat-card"><h3>🏆 Best Score</h3><p class="kid-stat-number">' + formatNumber(blind.overall_high_score) + '</p></article>',
            '</div>',
            '<h3 class="account-section-title" style="margin-top:1.5rem;">Daily challenges</h3>',
            '<div class="kid-stats-grid">',
            renderDailyChallengeBlock('Blind Rank Daily', brDaily),
            renderDailyChallengeBlock('Higher or Lower Daily', holDaily),
            renderDailyChallengeBlock('Codebreaker Daily', cbDaily),
            '</div>',
            '<p class="my-stat-line"><strong>Games you\'ve tried:</strong> ' + gamesList + '</p>',
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
        if (content) content.innerHTML = 'Loading your records...';
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
