document.addEventListener('DOMContentLoaded', function () {
    var Auth = window.JonesGamesAuth;
    var Sync = window.JonesGamesSync;
    var loginNote = document.getElementById('hofLoginNote');
    var bodyEl = document.getElementById('hallOfFameBody');

    function formatNumber(value) {
        var n = Number(value || 0);
        return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function renderRows(rows) {
        if (!bodyEl) return;
        var data = Array.isArray(rows) ? rows : [];
        if (!data.length) {
            bodyEl.innerHTML = '<tr><td colspan="7">No hall of fame entries yet.</td></tr>';
            return;
        }
        bodyEl.innerHTML = data.map(function (row) {
            var rank = Number(row.rank_position || 0);
            var rankClass = rank <= 3 ? ' class="rank-' + rank + '"' : '';
            return '<tr' + rankClass + '>' +
                '<td>' + formatNumber(rank) + '</td>' +
                '<td>' + escapeHtml(row.display_name || 'Player') + '</td>' +
                '<td>' + formatNumber(row.points) + '</td>' +
                '<td>' + formatNumber(row.first_count) + '</td>' +
                '<td>' + formatNumber(row.second_count) + '</td>' +
                '<td>' + formatNumber(row.third_count) + '</td>' +
                '<td>' + formatNumber(row.average_position) + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderLoggedOut() {
        if (loginNote) loginNote.style.display = 'block';
        if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="7">Log in to view Hall of Fame.</td></tr>';
    }

    function load() {
        if (!Auth || !Sync || !Sync.getHallOfFame) {
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
                return Sync.getHallOfFame(100).then(renderRows).catch(function () {
                    if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="7">Could not load Hall of Fame right now.</td></tr>';
                });
            })
            .catch(renderLoggedOut);
    }

    load();
});
