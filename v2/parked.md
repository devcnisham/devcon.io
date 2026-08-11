# Parked

Things noticed while doing something else, written down instead of done.

**This is an inbox, not a seventh document about v2's state.** It does not
restate what is built, what passes or what is left — `SHIP.md` decides,
`v2/task.md` tracks, and adding another describer would worsen task 20. Nothing
here is started, scheduled, or promised. Delete an entry when it is done or
when it stops being worth doing.

Newest first. Each entry says what was noticed, why it was left, and what it
would cost.

---

## `GIT_CONFIG_NOSYSTEM` is set but not covered by a test

*Noticed 2026-08-11, fixing task 42.*

`sandboxEnv()` sets `GIT_CONFIG_NOSYSTEM=1` alongside
`GIT_CONFIG_GLOBAL=/dev/null`. The global half is covered — remove it and five
tests go red. The system half is not: proving it would need an `/etc/gitconfig`
containing a bad include, and writing that needs root.

So it is a defensive setting with no failing test behind it, which is exactly
the kind of thing this repo does not let itself claim. Recorded rather than
quietly counted as covered.

**Cost to close:** unclear, and possibly not worth it. A test that needs `sudo`
is a test nobody runs, and CI would need the same. The alternative is to accept
it and say so — which is what this entry does.

## Two sandbox allows are now dead

*Noticed 2026-08-11, fixing task 42.*

The profile allows `$HOME/.gitconfig` and `$HOME/.config/git` with the comment
"git will not start without its global config". Since task 42, git is told not
to read either — `GIT_CONFIG_GLOBAL=/dev/null` — so both allows grant a read
that nothing performs.

Left in place deliberately. Removing them narrows the profile, which is good,
but it is a behaviour change riding along with an unrelated fix, and the
comment's claim ("will not start without") has not been retested since. If it
is true for some git version or subcommand, removing the allow reintroduces the
class of bug task 42 just closed.

**Cost to close:** small. Delete the two lines, run `pnpm test`, and if green,
rewrite the comment to say what was actually observed rather than what was
believed. If red, the comment was right and should say why.

## `pnpm test` prints a warning on every file

*Noticed 2026-08-11, reading CI logs.*

Every suite logs `[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of … is
not specified and it doesn't parse as CommonJS. Reparsing as ES module … This
incurs a performance overhead.` — eight times per run, locally and in CI.

Adding `"type": "module"` to `package.json` is the fix node suggests. It is one
line and it is not obviously free: Next.js reads that field, and this repo's
whole zero-client-JavaScript property depends on the build behaving exactly as
it does now.

**Cost to close:** one line plus a full gate run, including a build diff to
confirm 0 page chunks is unchanged. Worth doing on a quiet day, not alongside a
security fix.
