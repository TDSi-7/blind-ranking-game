/**
 * Jones Games – Auth (Supabase + Google).
 * When Supabase is not configured, the app runs in guest-only mode.
 */
(function () {
    const url = typeof window.__SUPABASE_URL__ !== 'undefined' ? window.__SUPABASE_URL__ : '';
    const anonKey = typeof window.__SUPABASE_ANON_KEY__ !== 'undefined' ? window.__SUPABASE_ANON_KEY__ : '';
    const isConfigured = Boolean(url && anonKey && url.startsWith('https://'));

    let supabase = null;
    let authListeners = [];

    if (!isConfigured) {
        window.__JonesGamesAuthInit__ = function () { return Promise.resolve(); };
    } else {
        try {
            // Dynamic import for Supabase (CDN); runs async so we init in initAuth().
            window.__JonesGamesAuthInit__ = function initAuth() {
                if (supabase) return Promise.resolve();
                return import('https://esm.sh/@supabase/supabase-js@2')
                    .then(function (mod) {
                        supabase = mod.createClient(url, anonKey);
                        supabase.auth.onAuthStateChange(function (event, session) {
                            authListeners.forEach(function (cb) { cb(session); });
                        });
                        return supabase.auth.getSession().then(function (_ref) {
                            var data = _ref.data;
                            authListeners.forEach(function (cb) { cb(data.session); });
                        });
                    })
                    .catch(function (err) {
                        console.warn('Jones Games: Supabase init failed', err);
                    });
            };
        } catch (e) {
            console.warn('Jones Games: Supabase not available', e);
            window.__JonesGamesAuthInit__ = function () { return Promise.resolve(); };
        }
    }

    function getSession() {
        if (!supabase) return Promise.resolve(null);
        return supabase.auth.getSession().then(function (_ref2) {
            var data = _ref2.data;
            return data.session;
        });
    }

    function getUser() {
        if (!supabase) return Promise.resolve(null);
        return supabase.auth.getUser().then(function (_ref3) {
            var data = _ref3.data;
            return data.user;
        });
    }

    function signInWithGoogle() {
        if (!supabase) return Promise.reject(new Error('Auth not configured'));
        return supabase.auth.signInWithOAuth({ provider: 'google' });
    }

    function signOut() {
        if (!supabase) return Promise.resolve();
        return supabase.auth.signOut();
    }

    function onAuthStateChange(callback) {
        if (typeof callback !== 'function') return;
        authListeners.push(callback);
        getSession().then(function (session) { callback(session); });
    }

    function getClient() {
        return supabase;
    }

    window.JonesGamesAuth = {
        isConfigured: function () { return isConfigured; },
        getClient: getClient,
        getSession: getSession,
        getUser: getUser,
        signInWithGoogle: signInWithGoogle,
        signOut: signOut,
        onAuthStateChange: onAuthStateChange
    };
})();
