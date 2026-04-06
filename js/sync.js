/**
 * Jones Games – Sync free-play stats between localStorage and Supabase.
 * When user is logged in, hub merges local + DB and writes both back.
 */

(function () {
    var Auth = window.JonesGamesAuth;
    var Hub = window.FunGamesHubProfiles;

    function mergeBlindRanking(db, local) {
        if (!db && !local) return {};
        var d = db || {};
        var l = local || {};
        var highScores = {
            easy: { highScore: 0, perfectGames: 0 },
            medium: { highScore: 0, perfectGames: 0 },
            hard: { highScore: 0, perfectGames: 0 }
        };
        ['easy', 'medium', 'hard'].forEach(function (level) {
            var de = (d.highScores && d.highScores[level]) || {};
            var le = (l.highScores && l.highScores[level]) || {};
            highScores[level] = {
                highScore: Math.max(de.highScore || 0, le.highScore || 0),
                perfectGames: Math.max(de.perfectGames || 0, le.perfectGames || 0)
            };
        });
        var dp = (d.playerStats) || {};
        var lp = (l.playerStats) || {};
        var playerStats = {
            gamesPlayed: Math.max(dp.gamesPlayed || 0, lp.gamesPlayed || 0),
            totalScore: (dp.totalScore || 0) + (lp.totalScore || 0),
            highScore: Math.max(dp.highScore || 0, lp.highScore || 0),
            scores: [].concat(Array.isArray(dp.scores) ? dp.scores : [], Array.isArray(lp.scores) ? lp.scores : []).slice(-200)
        };
        var byDifficulty = { easy: {}, medium: {}, hard: {} };
        ['easy', 'medium', 'hard'].forEach(function (level) {
            var dd = (dp.byDifficulty && dp.byDifficulty[level]) || {};
            var ld = (lp.byDifficulty && lp.byDifficulty[level]) || {};
            var gamesPlayed = Math.max(dd.gamesPlayed || 0, ld.gamesPlayed || 0);
            var totalScore = (dd.totalScore || 0) + (ld.totalScore || 0);
            var highScore = Math.max(dd.highScore || 0, ld.highScore || 0);
            byDifficulty[level] = {
                gamesPlayed: gamesPlayed,
                totalScore: totalScore,
                highScore: highScore,
                averageScore: gamesPlayed > 0 ? Number((totalScore / gamesPlayed).toFixed(2)) : 0
            };
        });
        playerStats.byDifficulty = byDifficulty;
        if (playerStats.gamesPlayed > 0 && playerStats.totalScore === 0 && playerStats.scores.length)
            playerStats.totalScore = playerStats.scores.reduce(function (a, b) { return a + b; }, 0);
        return { highScores: highScores, playerStats: playerStats };
    }

    function mergeMimi(db, local) {
        if (!db && !local) return {};
        var d = db || {};
        var l = local || {};
        return {
            gamesPlayed: Math.max(d.gamesPlayed || 0, l.gamesPlayed || 0),
            wins: Math.max(d.wins || 0, l.wins || 0),
            circlesWon: Math.max(d.circlesWon || 0, l.circlesWon || 0)
        };
    }

    function ensureClient() {
        if (Auth && Auth.getClient && Auth.getClient()) return Promise.resolve(Auth.getClient());
        if (window.__JonesGamesAuthInit__) return window.__JonesGamesAuthInit__().then(function () { return Auth && Auth.getClient && Auth.getClient(); });
        return Promise.resolve(null);
    }

    function pullStats(client, userId) {
        if (!client || !userId) return Promise.resolve({ byGame: {}, lastPlayed: {} });
        return client.from('game_stats').select('game_id, stats, last_played_at').eq('user_id', userId)
            .then(function (_ref) {
                var data = _ref.data, error = _ref.error;
                if (error) {
                    console.warn('Jones Games sync: pull failed', error);
                    return { byGame: {}, lastPlayed: {} };
                }
                var byGame = {};
                var lastPlayed = {};
                (data || []).forEach(function (row) {
                    byGame[row.game_id] = row.stats || {};
                    if (row.last_played_at) lastPlayed[row.game_id] = row.last_played_at;
                });
                return { byGame: byGame, lastPlayed: lastPlayed };
            });
    }

    function pushStats(client, userId, gameId, stats, lastPlayedAt) {
        if (!client || !userId) return Promise.resolve();
        return client.from('game_stats').upsert({
            user_id: userId,
            game_id: gameId,
            stats: stats,
            last_played_at: lastPlayedAt || null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,game_id' })
            .then(function (_ref2) {
                var error = _ref2.error;
                if (error) console.warn('Jones Games sync: push failed', gameId, error);
            });
    }

    function upsertProfile(client, userId, displayName, avatarUrl) {
        if (!client || !userId) return Promise.resolve();
        return client.from('profiles').upsert({
            id: userId,
            display_name: (displayName || 'Player').trim() || 'Player',
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' }).then(function (_ref3) {
            var error = _ref3.error;
            if (error) console.warn('Jones Games sync: profile upsert failed', error);
        });
    }

    function getProfile() {
        if (!Auth || !Auth.isConfigured()) return Promise.resolve(null);
        return Auth.getSession().then(function (session) {
            if (!session || !session.user) return Promise.resolve(null);
            return ensureClient().then(function (client) {
                if (!client) return Promise.resolve(null);
                return client.from('profiles').select('display_name, avatar_url').eq('id', session.user.id).maybeSingle().then(function (res) {
                    if (res.error) return null;
                    return res.data;
                });
            });
        });
    }

    function updateProfile(updates) {
        if (!Auth || !Auth.isConfigured()) return Promise.reject(new Error('Auth not configured'));
        return Auth.getSession().then(function (session) {
            if (!session || !session.user) return Promise.reject(new Error('Not signed in'));
            var userId = session.user.id;
            return ensureClient().then(function (client) {
                if (!client) return Promise.reject(new Error('No client'));
                var payload = { id: userId, updated_at: new Date().toISOString() };
                if (updates.display_name !== undefined) payload.display_name = (String(updates.display_name).trim() || 'Player').slice(0, 32);
                if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
                return client.from('profiles').upsert(payload, { onConflict: 'id' }).then(function (res) {
                    if (res.error) return Promise.reject(res.error);
                    if (payload.display_name !== undefined) {
                        return client.from('daily_challenge_completions')
                            .update({ display_name: payload.display_name, updated_at: new Date().toISOString() })
                            .eq('user_id', userId)
                            .then(function () { return res.data; });
                    }
                    return res.data;
                });
            });
        });
    }

    function getMyAccountStats() {
        if (!Auth || !Auth.isConfigured()) return Promise.resolve(null);
        return ensureClient().then(function (client) {
            if (!client) return null;
            return client.rpc('get_my_account_stats').then(function (res) {
                if (res.error) {
                    console.warn('Jones Games stats: get_my_account_stats failed', res.error);
                    return null;
                }
                return res.data || null;
            });
        });
    }

    function getHallOfFame(limit) {
        if (!Auth || !Auth.isConfigured()) return Promise.resolve([]);
        return ensureClient().then(function (client) {
            if (!client) return [];
            return client.rpc('get_hall_of_fame', { max_rows: limit || 100 }).then(function (res) {
                if (res.error) {
                    console.warn('Jones Games stats: get_hall_of_fame failed', res.error);
                    return [];
                }
                return res.data || [];
            });
        });
    }

    function syncWithServer() {
        if (!Auth || !Auth.isConfigured() || !Hub) return Promise.resolve();
        return Auth.getSession().then(function (session) {
            if (!session || !session.user) return Promise.resolve();
            var userId = session.user.id;
            var meta = session.user.user_metadata || {};
            var displayName = meta.full_name || meta.name || session.user.email || 'Player';
            var avatarUrl = meta.avatar_url || meta.picture || null;
            return ensureClient().then(function (client) {
                if (!client) return Promise.resolve();
                return client.from('profiles').select('display_name').eq('id', userId).maybeSingle().then(function (profileRes) {
                    var existingName = profileRes && profileRes.data && profileRes.data.display_name;
                    var effectiveName = existingName || displayName;
                    return upsertProfile(client, userId, effectiveName, avatarUrl);
                }).then(function () {
                    return pullStats(client, userId);
                }).then(function (pullResult) {
                    var dbStats = pullResult.byGame || {};
                    var lastPlayed = pullResult.lastPlayed || {};
                    var profileId = Hub.getCurrentProfileId();
                    var localStats = profileId ? Hub.getStats(profileId) : {};
                    var merged = {};
                    var br = mergeBlindRanking(dbStats['blind-ranking'], localStats['blind-ranking']);
                    if (Object.keys(br).length) merged['blind-ranking'] = br;
                    var mmc = mergeMimi(dbStats['mimi-memory-chess'], localStats['mimi-memory-chess']);
                    if (Object.keys(mmc).length) merged['mimi-memory-chess'] = mmc;
                    var promises = [];
                    Object.keys(merged).forEach(function (gameId) {
                        var payload = merged[gameId];
                        Hub.setStatsForGame(profileId, gameId, payload);
                        promises.push(pushStats(client, userId, gameId, payload, lastPlayed[gameId]));
                    });
                    return Promise.all(promises);
                });
            });
        }).catch(function (err) {
            console.warn('Jones Games sync error', err);
        });
    }

    window.JonesGamesSync = {
        syncWithServer: syncWithServer,
        getProfile: getProfile,
        updateProfile: updateProfile,
        getMyAccountStats: getMyAccountStats,
        getHallOfFame: getHallOfFame,
        pullStats: pullStats,
        pushStats: pushStats,
        mergeBlindRanking: mergeBlindRanking,
        mergeMimi: mergeMimi
    };
})();
