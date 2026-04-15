#!/usr/bin/env node
/**
 * Convert multi-club players CSV → guess-lfc-player/data/players.json
 *
 * Expected header row (commas, UTF-8):
 * name,club,position,debutYear,nationality,shirtNumber,boughtFrom,feePaid,soldTo,feeReceived,gamesPlayed,goals,assists,appearances
 *
 * - position: e.g. GK, CB, LB, RB, CM, DM, AM, LW, RW, ST (mapped to categories in the game)
 * - club: Liverpool / Manchester United / Manchester City / Arsenal / Tottenham / Chelsea
 * - soldTo / feeReceived: use empty, "Still at <Club>", or "—" for current players
 * - numeric fields: integers where possible
 *
 * Usage: node guess-lfc-player/scripts/csv-to-json.mjs path/to/players.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_CLUBS = new Set([
    'Liverpool',
    'Manchester United',
    'Manchester City',
    'Arsenal',
    'Tottenham',
    'Chelsea'
]);

function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && c === ',') {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
}

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) throw new Error('CSV needs header + at least one row');
    const headers = parseCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        if (cells.length === 1 && !cells[0]) continue;
        const row = {};
        headers.forEach((h, j) => {
            row[h] = cells[j] != null ? cells[j] : '';
        });
        rows.push(row);
    }
    return rows;
}

function normalizeRow(r) {
    const num = (v) => {
        const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
    };
    const str = (v) => (v == null || String(v).trim() === '' ? '—' : String(v).trim());
    const club = str(r.club);
    if (!VALID_CLUBS.has(club)) {
        throw new Error(`Invalid club "${club}" for player "${str(r.name)}"`);
    }
    return {
        name: str(r.name),
        club: club,
        position: str(r.position),
        debutYear: num(r.debutYear) || 0,
        nationality: str(r.nationality),
        shirtNumber: num(r.shirtNumber),
        boughtFrom: str(r.boughtFrom),
        feePaid: str(r.feePaid),
        soldTo: str(r.soldTo),
        feeReceived: str(r.feeReceived),
        gamesPlayed: num(r.gamesPlayed),
        goals: num(r.goals),
        assists: num(r.assists),
        appearances: num(r.appearances)
    };
}

function validateHeaders(rows) {
    if (!rows.length) return;
    const required = [
        'name',
        'club',
        'position',
        'debutYear',
        'nationality',
        'shirtNumber',
        'boughtFrom',
        'feePaid',
        'soldTo',
        'feeReceived',
        'gamesPlayed',
        'goals',
        'assists',
        'appearances'
    ];
    const first = rows[0];
    const missing = required.filter((k) => !(k in first));
    if (missing.length) {
        throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);
    }
}

function validateUnique(players) {
    const seen = new Set();
    for (const p of players) {
        const key = `${p.name}::${p.club}::${p.debutYear}`;
        if (seen.has(key)) {
            throw new Error(`Duplicate row found for key: ${key}`);
        }
        seen.add(key);
    }
}

const csvPath = process.argv[2];
if (!csvPath) {
    console.error('Usage: node csv-to-json.mjs <path-to.csv>');
    process.exit(1);
}

const abs = path.resolve(csvPath);
const raw = fs.readFileSync(abs, 'utf8');
const parsed = parseCsv(raw);
validateHeaders(parsed);
const players = parsed.map(normalizeRow).filter((p) => p.name && p.name !== '—');
validateUnique(players);

const outPath = path.join(__dirname, '..', 'data', 'players.json');
fs.writeFileSync(outPath, JSON.stringify({ players }, null, 2), 'utf8');
console.log('Wrote', players.length, 'players to', outPath);
