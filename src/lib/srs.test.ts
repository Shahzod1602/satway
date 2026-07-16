import test from "node:test";
import assert from "node:assert/strict";
import { nextReview, statusOf, isDue, dueQueue, SRS_INTERVALS_DAYS, MAX_BOX } from "./srs";

const NOW = new Date("2026-07-16T10:00:00Z");
const daysFrom = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

test("a new word answered correctly moves to box 1, due tomorrow", () => {
  const r = nextReview(null, true, NOW);
  assert.equal(r.box, 1);
  assert.equal(r.correctCount, 1);
  assert.equal(r.wrongCount, 0);
  assert.deepEqual(r.dueAt, daysFrom(NOW, 1));
});

test("a new word answered wrongly stays in box 0, due the same day", () => {
  const r = nextReview(null, false, NOW);
  assert.equal(r.box, 0);
  assert.equal(r.wrongCount, 1);
  assert.deepEqual(r.dueAt, NOW, "box 0 is a 0-day interval — see it again this session");
});

test("correct answers climb the boxes and lengthen the interval", () => {
  let state = { box: 0, correctCount: 0, wrongCount: 0 };
  const seen: number[] = [];
  for (let i = 0; i < 7; i++) {
    const r = nextReview(state, true, NOW);
    seen.push(r.box);
    state = { box: r.box, correctCount: r.correctCount, wrongCount: r.wrongCount };
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 5, 5], "climbs then saturates at MAX_BOX");
  assert.equal(state.correctCount, 7);
});

test("a wrong answer sends the word all the way back to box 0", () => {
  const r = nextReview({ box: 5, correctCount: 12, wrongCount: 0 }, false, NOW);
  assert.equal(r.box, 0, "not 4 — a half-remembered word is what fails on test day");
  assert.equal(r.wrongCount, 1);
  assert.equal(r.correctCount, 12, "history is kept");
});

test("the interval matches the box it lands in", () => {
  for (let box = 0; box < MAX_BOX; box++) {
    const r = nextReview({ box, correctCount: 0, wrongCount: 0 }, true, NOW);
    assert.deepEqual(
      r.dueAt,
      daysFrom(NOW, SRS_INTERVALS_DAYS[box + 1]),
      `box ${box} + correct → box ${box + 1} interval`,
    );
  }
});

test("statusOf reports new / learning / learned", () => {
  assert.equal(statusOf(null), "new");
  assert.equal(statusOf({ box: 0 }), "learning");
  assert.equal(statusOf({ box: 2 }), "learning");
  assert.equal(statusOf({ box: 3 }), "learned");
  assert.equal(statusOf({ box: 5 }), "learned");
});

test("a word never seen is always due", () => {
  assert.equal(isDue(null, NOW), true);
  assert.equal(isDue(undefined, NOW), true);
});

test("isDue compares against the due date", () => {
  assert.equal(isDue({ dueAt: daysFrom(NOW, -1) }, NOW), true, "overdue");
  assert.equal(isDue({ dueAt: NOW }, NOW), true, "due exactly now");
  assert.equal(isDue({ dueAt: daysFrom(NOW, 1) }, NOW), false, "not yet");
});

test("dueQueue returns only due words, hardest (lowest box) first", () => {
  const words = [
    { wordId: "easy" },
    { wordId: "hard" },
    { wordId: "notdue" },
    { wordId: "fresh" },
  ];
  const progress = new Map([
    ["easy", { box: 4, dueAt: daysFrom(NOW, -1) }],
    ["hard", { box: 0, dueAt: daysFrom(NOW, -1) }],
    ["notdue", { box: 2, dueAt: daysFrom(NOW, 5) }],
    // "fresh" has no row at all → new → always due, treated as box 0
  ]);

  const q = dueQueue(words, progress, NOW);
  assert.deepEqual(
    q.map((w) => w.wordId),
    ["hard", "fresh", "easy"],
    "notdue is excluded; box 0 leads, box 4 trails",
  );
});
