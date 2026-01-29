/**
 * Fun Games Hub - Profile and stats API (localStorage)
 * Games read/write stats under funGamesHub_stats[profileId][gameId].
 */

const PROFILES_KEY = 'funGamesHub_profiles';
const CURRENT_PROFILE_KEY = 'funGamesHub_currentProfileId';
const STATS_KEY = 'funGamesHub_stats';

function generateId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function getProfiles() {
    try {
        const raw = localStorage.getItem(PROFILES_KEY);
        if (!raw) return [];
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function saveProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function getCurrentProfileId() {
    return localStorage.getItem(CURRENT_PROFILE_KEY) || null;
}

function setCurrentProfileId(profileId) {
    if (profileId) {
        localStorage.setItem(CURRENT_PROFILE_KEY, profileId);
    } else {
        localStorage.removeItem(CURRENT_PROFILE_KEY);
    }
}

function createProfile(name) {
    const profiles = getProfiles();
    const id = generateId();
    const profile = { id, name: (name || 'Player').trim() || 'Player', createdAt: Date.now() };
    profiles.push(profile);
    saveProfiles(profiles);
    setCurrentProfileId(id);
    return profile;
}

function getStats(profileId) {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (!raw) return {};
        const all = JSON.parse(raw);
        return all[profileId] || {};
    } catch {
        return {};
    }
}

function getStatsForGame(profileId, gameId) {
    const stats = getStats(profileId);
    return stats[gameId] || null;
}

function setStatsForGame(profileId, gameId, data) {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        const all = raw ? JSON.parse(raw) : {};
        if (!all[profileId]) all[profileId] = {};
        all[profileId][gameId] = { ...(all[profileId][gameId] || {}), ...data };
        localStorage.setItem(STATS_KEY, JSON.stringify(all));
    } catch (e) {
        console.error('profiles.js setStatsForGame', e);
    }
}

function getCurrentProfile() {
    const id = getCurrentProfileId();
    if (!id) return null;
    const profiles = getProfiles();
    return profiles.find(p => p.id === id) || null;
}

function ensureCurrentProfile() {
    let id = getCurrentProfileId();
    if (id) {
        const profiles = getProfiles();
        if (profiles.some(p => p.id === id)) return id;
    }
    const profile = createProfile('Player');
    return profile.id;
}

window.FunGamesHubProfiles = {
    getProfiles,
    getCurrentProfileId,
    setCurrentProfileId,
    createProfile,
    getStats,
    getStatsForGame,
    setStatsForGame,
    getCurrentProfile,
    ensureCurrentProfile,
    PROFILES_KEY,
    CURRENT_PROFILE_KEY,
    STATS_KEY
};
