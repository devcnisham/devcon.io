import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { parseSpec } from "../lib/ship/parse.ts";

/**
 * `SHIP.md`'s reader.
 *
 * Every other module in `lib/` had a suite for two days while this one had
 * none, and in that window it shipped the worst defect in the repo:
 * `(?=^##\s|\Z)`. `\Z` is Perl, not JavaScript, so it compiled to "the literal
 * letter z" and every section truncated at its first one — "frozen" became
 * "fro" and took thirteen of fourteen conditions with it. It read as bad
 * markdown, not a bad parser.
 *
 * So `SPEC` below opens every section body with a word containing a `z`, and
 * the last block parses the repo's own `SHIP.md` — the input the app runs on.
 */

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const SPEC = `# Ship — a fixture

**One sentence that wraps
across two lines.**

Deadline: 2026-09-01

---

## Not shipping

A dozen reasons sit in this paragraph, which is prose and not a cut.

- **A step catalog** — the plan is not knowable in advance, and this reason
  wraps onto a second line.
- **Accounts** – nobody is sharing anything yet.
- **Telemetry** - nothing to measure until one person ships one thing.
- A bullet with no bold name.

## Done when

- [x] The frozen tree is reachable
      \`check: exit 0\`
- [X] A capital X is still a tick
- [ ] An unticked condition with a check
      \`check: test "$(git rev-list --max-parents=0 HEAD | grep -c .)" -eq 1\`
- [ ] A condition whose prose wraps onto
      a second line and has no check

## Assumptions

A dozen of these would be too many.

- A spec is more useful than a plan.
- Reading repo structure is enough to critique, without reading
  source.

## What this file has already taught

- **A ticked box is a claim** — this bullet is in no parsed section and must
  not become a cut.
`;

const parsed = parseSpec(SPEC);

describe("a section ends where the next one starts, and nowhere else", () => {
  test("a `z` in the body does not truncate the section", () => {
    // The regression. Under `\Z` every one of these collapsed to zero.
    assert.equal(parsed.cuts.length, 3, "cuts truncated");
    assert.equal(parsed.conditions.length, 4, "conditions truncated");
    assert.equal(parsed.assumptions.length, 2, "assumptions truncated");

    // Not just the count — the word that broke first must survive whole.
    assert.match(parsed.conditions[0].text, /frozen/);
  });

  test("the next `##` ends it, so sections do not bleed into each other", () => {
    assert.ok(parsed.cuts.length > 0);
    for (const c of parsed.cuts) {
      assert.doesNotMatch(c.thing, /ticked box/i, "read past `## Done when`");
      assert.doesNotMatch(c.reason, /parsed section/i);
    }
    assert.ok(parsed.conditions.length > 0);
    for (const c of parsed.conditions) {
      assert.doesNotMatch(c.text, /step catalog/i, "read back into cuts");
    }
  });

  test("a `###` is not a `##` and does not end the section", () => {
    const md = `# Sub

## Done when

### Ticked

- [x] Under a \`###\`, still inside the section
`;
    assert.equal(parseSpec(md).conditions.length, 1);
  });

  test("the heading is matched whatever its case", () => {
    const md = `# Case

## NOT SHIPPING

- **A web app** — the agent is already a UI.
`;
    assert.deepEqual(
      parseSpec(md).cuts.map((c) => c.thing),
      ["A web app"],
    );
  });

  test("a heading that only starts the same way is a different section", () => {
    const md = `# Near

## Not shipping yet

- **A web app** — the agent is already a UI.
`;
    assert.equal(parseSpec(md).cuts.length, 0);
  });

  test("a missing section is empty, not a crash", () => {
    const bare = parseSpec("# Only a title\n");
    assert.deepEqual(bare.cuts, []);
    assert.deepEqual(bare.conditions, []);
    assert.deepEqual(bare.assumptions, []);
    assert.equal(bare.name, "Only a title");
    assert.equal(bare.shipping, "");
    assert.equal(bare.deadline, null);
  });

  test("an empty file parses to an empty spec", () => {
    const nothing = parseSpec("");
    assert.equal(nothing.name, "Untitled");
    assert.equal(nothing.shipping, "");
    assert.equal(nothing.conditions.length, 0);
  });
});

describe("wrapped lines are folded back in", () => {
  test("a reason that wraps keeps its second half", () => {
    // Reading only the bullet's first line drops the end of every long one,
    // and a truncated reason reads as a complete one.
    const [catalog] = parsed.cuts;
    assert.equal(
      catalog.reason,
      "the plan is not knowable in advance, and this reason wraps onto a second line.",
    );
  });

  test("a condition that wraps keeps its second half", () => {
    assert.equal(
      parsed.conditions[3].text,
      "A condition whose prose wraps onto a second line and has no check",
    );
  });

  test("an assumption that wraps keeps its second half", () => {
    assert.equal(
      parsed.assumptions[1],
      "Reading repo structure is enough to critique, without reading source.",
    );
  });

  test("prose before the first bullet is dropped, not folded into one", () => {
    assert.ok(parsed.cuts.length > 0);
    for (const c of parsed.cuts) {
      assert.doesNotMatch(c.reason, /dozen reasons/);
      assert.doesNotMatch(c.thing, /dozen reasons/);
    }
    assert.ok(parsed.assumptions.length > 0);
    for (const a of parsed.assumptions) {
      assert.doesNotMatch(a, /too many/);
    }
  });

  test("prose AFTER a bullet is swallowed by it — a real hole, not a wish", () => {
    // `bullets()` cannot tell a wrapped line from a new paragraph, so any prose
    // between two bullets lands on the end of the one above it. `SHIP.md` puts
    // its prose before the bullets and never trips this, which is luck rather
    // than design. Left asserted rather than fixed so the limit is visible: if
    // `bullets()` ever learns about blank lines, this test goes red and the
    // reader gets sent here.
    const md = `# Prose

## Not shipping

- **A web app** — the agent is already a UI.

This paragraph explains the one above.

- **Telemetry** — nothing to measure yet.
`;
    const { cuts } = parseSpec(md);
    assert.equal(cuts.length, 2);
    assert.equal(
      cuts[0].reason,
      "the agent is already a UI. This paragraph explains the one above.",
    );
    assert.equal(cuts[1].reason, "nothing to measure yet.");
  });
});

describe("cuts", () => {
  test("em dash, en dash and hyphen all separate a cut from its reason", () => {
    // Nobody remembers which one a parser wants, so all three work.
    assert.deepEqual(
      parsed.cuts.map((c) => c.thing),
      ["A step catalog", "Accounts", "Telemetry"],
    );
    assert.equal(parsed.cuts[1].reason, "nobody is sharing anything yet.");
    assert.equal(
      parsed.cuts[2].reason,
      "nothing to measure until one person ships one thing.",
    );
  });

  test("a bullet with no bold name is dropped entirely", () => {
    // A cut without a reason is just an omission — but so is a cut the parser
    // silently ate. It vanishes rather than arriving with an empty reason, and
    // nothing tells the author. Asserted so the behaviour is a decision.
    assert.ok(parsed.cuts.length > 0);
    for (const c of parsed.cuts) {
      assert.doesNotMatch(c.thing, /no bold name/);
    }
    assert.equal(
      parseSpec("# X\n\n## Not shipping\n\n- Just prose.\n").cuts.length,
      0,
    );
  });

  test("order is the file's order", () => {
    assert.equal(parsed.cuts[0].thing, "A step catalog");
    assert.equal(parsed.cuts[2].thing, "Telemetry");
  });
});

describe("done-when conditions", () => {
  test("`[x]` and `[X]` are claimed, `[ ]` is not", () => {
    assert.deepEqual(
      parsed.conditions.map((c) => c.claimed),
      [true, true, false, false],
    );
  });

  test("a check is lifted out of the prose, not left in it", () => {
    assert.equal(parsed.conditions[0].check, "exit 0");
    assert.equal(parsed.conditions[0].text, "The frozen tree is reachable");
    assert.ok(parsed.conditions.length > 0);
    for (const c of parsed.conditions) {
      assert.doesNotMatch(c.text, /check:/, `check leaked into: ${c.text}`);
      assert.doesNotMatch(c.text, /`/, `backticks left in: ${c.text}`);
    }
  });

  test("a check keeps its shell verbatim, quotes and substitutions and all", () => {
    // The checker runs this string. Anything the parser trims off here is a
    // command that silently means something else.
    assert.equal(
      parsed.conditions[2].check,
      'test "$(git rev-list --max-parents=0 HEAD | grep -c .)" -eq 1',
    );
  });

  test("no check means undefined, which is a human deciding", () => {
    assert.equal(parsed.conditions[1].check, undefined);
    assert.equal(parsed.conditions[3].check, undefined);
  });

  test("`check:` without backticks stays prose", () => {
    // The backticks are the convention. Without them there is no way to tell a
    // command from someone writing about one, and guessing would run it.
    const md = "# X\n\n## Done when\n\n- [ ] Ask it to check: the remote\n";
    const [c] = parseSpec(md).conditions;
    assert.equal(c.check, undefined);
    assert.equal(c.text, "Ask it to check: the remote");
  });

  test("a bullet that is not a checkbox is skipped, not parsed as one", () => {
    const md =
      "# X\n\n## Done when\n\n- A note about the list\n- [ ] A real one\n";
    assert.deepEqual(
      parseSpec(md).conditions.map((c) => c.text),
      ["A real one"],
    );
  });
});

describe("the title, the one sentence and the deadline", () => {
  test("the title is the first `#` line", () => {
    assert.equal(parsed.name, "Ship — a fixture");
  });

  test("a file with no title is Untitled rather than empty", () => {
    assert.equal(parseSpec("## Done when\n").name, "Untitled");
  });

  test("the one sentence is the bold line under the title, unwrapped", () => {
    assert.equal(parsed.shipping, "One sentence that wraps across two lines.");
  });

  test("a bold cut name is not mistaken for the one sentence", () => {
    // The search stops at the first `##`, so everything below is out of reach.
    const md =
      "# X\n\n## Not shipping\n\n- **A web app** — the agent is a UI.\n";
    assert.equal(parseSpec(md).shipping, "");
  });

  test("a date is kept as written", () => {
    assert.equal(parsed.deadline, "2026-09-01");
  });

  test("`none` is no deadline, whatever follows it", () => {
    // `SHIP.md` says "none. Judged on whether Nisham uses it on his own
    // projects." — a sentence, and still not a date.
    for (const raw of ["none", "None", "none. Judged on use.", "NONE — ever"]) {
      const md = `# X\n\nDeadline: ${raw}\n`;
      assert.equal(parseSpec(md).deadline, null, `deadline: ${raw}`);
    }
  });

  test("a missing deadline is null", () => {
    assert.equal(parseSpec("# X\n").deadline, null);
  });
});

describe("the repo's own SHIP.md", () => {
  // The file the app reads. Asserted on properties rather than counts, so
  // adding a condition does not turn the parser red.
  const real = parseSpec(readFileSync(`${REPO}/SHIP.md`, "utf8"));

  test("it parses into all four parts", () => {
    assert.equal(real.name, "Ship — devcon v2");
    assert.match(real.shipping, /^A shipping critic/);
    assert.equal(real.deadline, null);
    assert.ok(real.cuts.length >= 6, `${real.cuts.length} cuts`);
    assert.ok(real.conditions.length >= 13, `${real.conditions.length} conds`);
    assert.ok(real.assumptions.length >= 3);
  });

  test("the condition that broke first survives whole", () => {
    // "v0.1 is frozen and reachable, not deleted" — the `z` that ate the file.
    const frozen = real.conditions.find((c) => /frozen/.test(c.text));
    assert.ok(frozen, "the frozen condition is gone");
    assert.match(frozen.text, /not deleted$/);
    assert.equal(frozen.check, "git rev-parse --verify --quiet v0.1-archive");
  });

  test("nothing parsed is blank", () => {
    assert.ok(real.conditions.length > 0);
    for (const c of real.conditions) {
      assert.ok(c.text.length > 0, "a condition with no prose");
      if (c.check !== undefined) assert.ok(c.check.length > 0, c.text);
    }
    assert.ok(real.cuts.length > 0);
    for (const c of real.cuts) {
      assert.ok(c.thing.length > 0);
      assert.ok(c.reason.length > 0, `${c.thing} has no reason`);
    }
    assert.ok(real.assumptions.length > 0);
    for (const a of real.assumptions) assert.ok(a.length > 0);
  });

  test("no check leaks into a condition's prose", () => {
    assert.ok(real.conditions.length > 0);
    for (const c of real.conditions) {
      assert.doesNotMatch(c.text, /check:/, c.text);
    }
  });

  test("the multi-line shell check comes back in one piece", () => {
    const root = real.conditions.find((c) => /empty tree/.test(c.text));
    assert.ok(root, "the root-commit condition is gone");
    assert.equal(
      root.check,
      'test "$(git show --name-only --format= $(git rev-list --max-parents=0 HEAD) | grep -c .)" -eq 2',
    );
  });

  test("the sections below `## Assumptions` are not parsed as cuts", () => {
    // "What this file has already taught" is bullets of the same `**x** — y`
    // shape. If `section()` ever ran past its terminator they would arrive as
    // cuts, and the spec would claim to be cutting its own lessons.
    assert.ok(real.cuts.length > 0);
    for (const c of real.cuts) {
      assert.doesNotMatch(c.thing, /ticked box|can expire/i, c.thing);
    }
  });
});
