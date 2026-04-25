# Contributing to StockActAlert

This is currently a solo project, but the workflow below treats it as if multiple
people might join later. Following it consistently is what gives a young codebase
the feel of a real product instead of a side-experiment.

## Branching

- `main` — always reflects what's running on production (`stockactalert.vercel.app`)
- `dev` — integration branch; all merged work lands here first and is verified on the Vercel preview before promotion to `main`
- `feature/<short-name>` — short-lived branches for individual changes; merged into `dev` when complete

## Commit messages

- Prefix with the Linear ticket: `SAA-12: add useTrades hook`
- Lowercase verb in present tense: `add`, `fix`, `refactor`, `remove`
- Keep the subject under ~70 characters
- Body is optional; use it for context or rationale when the diff is non-obvious

## Releases and changelog

Every merge to `main` is a production release. After every such merge:

1. **Decide the version bump** following [SemVer](https://semver.org):
   - `MAJOR` — breaking change for users (rare in this project)
   - `MINOR` — new user-facing feature
   - `PATCH` — bugfix, copy change, polish, refactor with no behaviour change

2. **Update `CHANGELOG.md`**:
   - Move items from `[Unreleased]` to a new versioned section, or add a fresh section
   - Use the existing `Added` / `Changed` / `Fixed` / `Removed` / `Performance` headings
   - Reference Linear tickets (e.g. `(SAA-18)`)
   - Add the version-comparison link at the bottom

3. **Tag the commit** on `main`:

   ```bash
   git tag -a v0.5.0 -m "v0.5.0"
   git push origin v0.5.0
   ```

4. **Create a GitHub Release** at <https://github.com/1am-it/stockactalert/releases/new>:
   - Choose the tag you just pushed
   - Title: `v0.5.0` (or matching)
   - Body: copy the matching section from `CHANGELOG.md`
   - Publish

GitHub Releases are how external users discover what's new. People can subscribe
to releases via the repo's "Watch → Releases only" option — no email infrastructure
needed at this stage.

## Pre-deploy checklist

Before any merge to `main`:

- [ ] Tested on the Vercel `dev` preview URL
- [ ] No console errors in browser DevTools during testing
- [ ] Ticket has a closing comment in Linear with test results
- [ ] CHANGELOG entry drafted

## Why this matters even for solo work

Future-you is a different person from today-you. Six months from now, when you
return to this codebase, the changelog tells you what you shipped, the commit
prefixes tell you why each change exists, and the GitHub Releases page is a
visual timeline of progress.

It also makes onboarding a real collaborator (or evaluating the project for a
portfolio review) trivial: they read `CHANGELOG.md` for 30 seconds and they're
caught up.
