import test from "node:test";
import assert from "node:assert/strict";
import {
  tashkentDayKey,
  computeStreak,
  computeLongestStreak,
  effectiveStreak,
  streakAfterSubmission,
} from "./streak";

// Tashkent is UTC+5. 19:00 UTC is already TOMORROW in Tashkent — every test below that
// looks off by one is testing exactly that.
const utc = (s: string) => new Date(`${s}Z`);

test("tashkentDayKey rolls over at 19:00 UTC", () => {
  assert.equal(tashkentDayKey(utc("2026-07-15T18:59:00")), "2026-07-15");
  assert.equal(tashkentDayKey(utc("2026-07-15T19:00:00")), "2026-07-16");
});

test("computeStreak counts consecutive days ending today", () => {
  const now = utc("2026-07-16T10:00:00"); // 15:00 Tashkent, 2026-07-16
  const days = [
    utc("2026-07-16T05:00:00"),
    utc("2026-07-15T05:00:00"),
    utc("2026-07-14T05:00:00"),
  ];
  assert.equal(computeStreak(days, now), 3);
});

test("missing today does not break the streak until tomorrow", () => {
  const now = utc("2026-07-16T10:00:00");
  const days = [utc("2026-07-15T05:00:00"), utc("2026-07-14T05:00:00")];
  assert.equal(computeStreak(days, now), 2, "yesterday+ still counts today");

  const tomorrow = utc("2026-07-17T10:00:00");
  assert.equal(computeStreak(days, tomorrow), 0, "two days idle → broken");
});

test("a gap ends the streak", () => {
  const now = utc("2026-07-16T10:00:00");
  const days = [
    utc("2026-07-16T05:00:00"),
    // 07-15 missing
    utc("2026-07-14T05:00:00"),
    utc("2026-07-13T05:00:00"),
  ];
  assert.equal(computeStreak(days, now), 1);
});

test("computeLongestStreak finds the best run, across a month boundary", () => {
  const days = [
    utc("2026-06-29T05:00:00"),
    utc("2026-06-30T05:00:00"),
    utc("2026-07-01T05:00:00"),
    utc("2026-07-02T05:00:00"), // run of 4 spanning June→July
    utc("2026-07-10T05:00:00"), // run of 1
  ];
  assert.equal(computeLongestStreak(days), 4);
});

test("computeLongestStreak ignores duplicate submissions on one day", () => {
  const days = [
    utc("2026-07-01T05:00:00"),
    utc("2026-07-01T09:00:00"),
    utc("2026-07-01T14:00:00"),
  ];
  assert.equal(computeLongestStreak(days), 1);
});

test("effectiveStreak decays a stale stored value", () => {
  const now = utc("2026-07-16T10:00:00");
  assert.equal(effectiveStreak(5, "2026-07-16", now), 5, "active today");
  assert.equal(effectiveStreak(5, "2026-07-15", now), 5, "active yesterday — still alive");
  assert.equal(effectiveStreak(5, "2026-07-14", now), 0, "two days stale → dead");
  assert.equal(effectiveStreak(5, null, now), 0);
  assert.equal(effectiveStreak(0, "2026-07-16", now), 0);
});

test("streakAfterSubmission extends, resets, and no-ops correctly", () => {
  const now = utc("2026-07-16T10:00:00");

  assert.equal(
    streakAfterSubmission({ currentStreak: 3, longestStreak: 9, lastActiveDay: "2026-07-16" }, now),
    null,
    "already practised today → no write",
  );

  assert.deepEqual(
    streakAfterSubmission({ currentStreak: 3, longestStreak: 9, lastActiveDay: "2026-07-15" }, now),
    { currentStreak: 4, longestStreak: 9, lastActiveDay: "2026-07-16" },
    "consecutive day extends",
  );

  assert.deepEqual(
    streakAfterSubmission({ currentStreak: 3, longestStreak: 9, lastActiveDay: "2026-07-10" }, now),
    { currentStreak: 1, longestStreak: 9, lastActiveDay: "2026-07-16" },
    "gap resets to 1",
  );

  assert.deepEqual(
    streakAfterSubmission({ currentStreak: 9, longestStreak: 9, lastActiveDay: "2026-07-15" }, now),
    { currentStreak: 10, longestStreak: 10, lastActiveDay: "2026-07-16" },
    "a new record raises longestStreak",
  );

  assert.deepEqual(
    streakAfterSubmission({ currentStreak: 0, longestStreak: 0, lastActiveDay: null }, now),
    { currentStreak: 1, longestStreak: 1, lastActiveDay: "2026-07-16" },
    "first ever submission",
  );
});

test("streak survives a submission just after the Tashkent rollover", () => {
  // 19:30 UTC on the 15th = 00:30 Tashkent on the 16th. A student practising late at
  // night must extend the streak, not reset it — this is the bug the Tashkent offset
  // exists to prevent.
  const now = utc("2026-07-15T19:30:00");
  assert.deepEqual(
    streakAfterSubmission({ currentStreak: 2, longestStreak: 2, lastActiveDay: "2026-07-15" }, now),
    { currentStreak: 3, longestStreak: 3, lastActiveDay: "2026-07-16" },
  );
});
