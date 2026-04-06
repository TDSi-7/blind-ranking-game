/**
 * Shared UTC date + deterministic RNG for daily challenge games.
 */
(function (global) {
    function getTodayDateUTC() {
        var d = new Date();
        var y = d.getUTCFullYear();
        var m = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function hashString(str) {
        var h = 0;
        for (var i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i) | 0;
        }
        return Math.abs(h) >>> 0;
    }

    function mulberry32(seed) {
        return function () {
            var t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function shuffleSeeded(arr, rng) {
        var a = arr.slice();
        var i;
        for (i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rng() * (i + 1));
            var t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function getOrdinalSuffix(day) {
        if (day % 100 >= 11 && day % 100 <= 13) return 'th';
        var last = day % 10;
        if (last === 1) return 'st';
        if (last === 2) return 'nd';
        if (last === 3) return 'rd';
        return 'th';
    }

    function formatDisplayDateUTC(dateStr) {
        if (!dateStr) return '';
        var parts = String(dateStr).split('-');
        if (parts.length !== 3) return dateStr;
        var y = Number(parts[0]);
        var m = Number(parts[1]) - 1;
        var d = Number(parts[2]);
        var utcDate = new Date(Date.UTC(y, m, d));
        if (isNaN(utcDate.getTime())) return dateStr;
        var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return weekdays[utcDate.getUTCDay()] + ' ' + d + getOrdinalSuffix(d) + ' ' + months[m];
    }

    global.JonesGamesDailySeed = {
        getTodayDateUTC: getTodayDateUTC,
        hashString: hashString,
        mulberry32: mulberry32,
        shuffleSeeded: shuffleSeeded,
        formatDisplayDateUTC: formatDisplayDateUTC
    };
})(typeof window !== 'undefined' ? window : this);
