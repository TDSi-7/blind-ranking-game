#!/usr/bin/env node
/**
 * Convert LFC players CSV → guess-lfc-player/data/players.json
 *
 * Expected header row (commas, UTF-8):
 * name,position,debutYear,nationality,shirtNumber,boughtFrom,feePaid,soldTo,feeReceived,gamesPlayed,goals,assists,appearances
 *
 * - position: e.g. GK, CB, LB, RB, CM, DM, AM, LW, RW, ST (mapped to categories in the game)
 * - soldTo / feeReceived: use empty, "Still at Liverpool", or "—" for current players
 * - numeric fields: integers where possible
 *
 * Usage: node guess-lfc-player/scripts/csv-to-json.mjs path/to/players.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    return {
        name: str(r.name),
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

const csvPath = process.argv[2];
if (!csvPath) {
    console.error('Usage: node csv-to-json.mjs <path-to.csv>');
    process.exit(1);
}

const abs = path.resolve(csvPath);
const raw = fs.readFileSync(abs, 'utf8');
const parsed = parseCsv(raw);
const players = parsed.map(normalizeRow).filter((p) => p.name && p.name !== '—');

const outPath = path.join(__dirname, '..', 'data', 'players.json');
fs.writeFileSync(outPath, JSON.stringify({ players }, null, 2), 'utf8');
console.log('Wrote', players.length, 'players to', outPath);
