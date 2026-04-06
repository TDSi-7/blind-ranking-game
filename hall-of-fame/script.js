document.addEventListener('DOMContentLoaded', function () {
    var Auth = window.JonesGamesAuth;
    var Sync = window.JonesGamesSync;
    var loginNote = document.getElementById('hofLoginNote');
    var bodyEl = document.getElementById('hallOfFameBody');
    var tabsEl = document.getElementById('hofTabs');

    var STORAGE_KEY = 'jones_hof_challenge_tab';
    var currentChallengeId = 'blind_ranking';

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
        var data = (Array.isArray(rows) ? rows : []).filter(function (row) {
            return String((row && row.display_name) || '').trim().toLowerCase() !== 'si test';
        });
        if (!data.length) {
            bodyEl.innerHTML = '<tr><td colspan="7">No hall of fame entries yet for this daily challenge.</td></tr>';
            return;
        }
        bodyEl.innerHTML = data.map(function (row, index) {
            var rank = index + 1;
            var rankClass = rank <= 3 ? ' class="rank-' + rank + '"' : '';
            var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            return '<tr' + rankClass + '>' +
                '<td><span class="rank-medal">' + medal + '</span> ' + formatNumber(rank) + '</td>' +
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

    function setTabSelection(challengeId) {
        currentChallengeId = challengeId || 'blind_ranking';
        try {
            sessionStorage.setItem(STORAGE_KEY, currentChallengeId);
        } catch (e) {}
        if (!tabsEl) return;
        var buttons = tabsEl.querySelectorAll('.hof-tab');
        buttons.forEach(function (btn) {
            var id = btn.getAttribute('data-challenge-id');
            var sel = id === currentChallengeId;
            btn.setAttribute('aria-selected', sel ? 'true' : 'false');
        });
    }

    function loadTable() {
        if (!Sync || !Sync.getHallOfFame) {
            renderLoggedOut();
            return;
        }
        if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        return Sync.getHallOfFame(100, currentChallengeId).then(renderRows).catch(function () {
            if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="7">Could not load Hall of Fame right now.</td></tr>';
        });
    }

    function initTabs() {
        try {
            var saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved && /^(blind_ranking|higher_or_lower|codebreaker)$/.test(saved)) {
                currentChallengeId = saved;
            }
        } catch (e) {}
        setTabSelection(currentChallengeId);
        if (tabsEl) {
            tabsEl.addEventListener('click', function (e) {
                var btn = e.target.closest('.hof-tab');
                if (!btn) return;
                var cid = btn.getAttribute('data-challenge-id');
                if (!cid) return;
                setTabSelection(cid);
                loadTable();
            });
        }
    }

    function load() {
        if (!Auth || !Sync || !Sync.getHallOfFame) {
            renderLoggedOut();
            return;
        }
        initTabs();
        (window.__JonesGamesAuthInit__ ? window.__JonesGamesAuthInit__() : Promise.resolve())
            .then(function () { return Auth.getSession(); })
            .then(function (session) {
                if (!session || !session.user) {
                    renderLoggedOut();
                    return;
                }
                if (loginNote) loginNote.style.display = 'none';
                return loadTable();
            })
            .catch(renderLoggedOut);
    }

    load();
});
