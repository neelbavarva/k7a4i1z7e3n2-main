// GET /api/calendar: this week's economic calendar (and next week's once it's published), live
// from the ForexFactory feed. A Vercel function; the dev server answers the same path with this
// file (vite.config.js). The CDN keeps each answer for CAL_CACHE_MINUTES and a warm instance
// remembers it as long, so the feed sees a few requests an hour however many people have the page open.

import { liveCalendar } from '../pipeline/lib/calendar.js';
import { CAL_CACHE_MINUTES } from '../src/constants.js';

const KEEP_MS = CAL_CACHE_MINUTES * 60 * 1000;
let last = null; // { at, body }

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (!last || Date.now() - last.at > KEEP_MS) last = { at: Date.now(), body: JSON.stringify(await liveCalendar()) };
    res.setHeader('Cache-Control', `public, max-age=60, s-maxage=${CAL_CACHE_MINUTES * 60}, stale-while-revalidate=1800`);
    res.statusCode = 200;
    res.end(last.body);
  } catch (err) {
    console.error('calendar:', err.message);
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "The calendar feed couldn't be reached." }));
  }
}
