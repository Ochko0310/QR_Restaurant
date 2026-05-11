// Single-tenant setup: all staff share one realtime room. Read from env so
// ops can change it without code edits; default matches legacy hardcoded name.
export const STAFF_ROOM = process.env["STAFF_ROOM"] ?? "restaurant_1";
