# Git Workflow — NeuroTech Events

This repository uses a protected working pattern intended to keep `main` stable and implementation history easy to review.

## Branch roles

### `main`

`main` is the stable integration branch.

- Do not implement features directly on `main`.
- Changes should arrive through reviewed pull requests.
- `main` should remain buildable.

### `masterchanges`

`masterchanges` is the default implementation branch for active work requested by the maintainer.

- All normal implementation work starts here unless another branch is explicitly requested.
- Keep it synchronized with `main` before significant new work if `main` has moved.
- Do not use it as a dump for unrelated changes.

## Standard workflow

```bash
git checkout main
git pull origin main

git checkout masterchanges
git merge main
```

If `masterchanges` does not yet exist locally:

```bash
git checkout -b masterchanges origin/main
git push -u origin masterchanges
```

Then implement in small units:

```bash
git add <specific-files>
git commit -m "feat: implement event card state"
```

Avoid `git add .` when the working tree contains unrelated changes.

## Commit policy

Each commit should answer one clear question: **what changed, and why is this unit independently reviewable?**

Preferred prefixes:

- `feat:` new user-facing capability
- `fix:` bug correction
- `docs:` documentation only
- `refactor:` code restructuring without intended behavior change
- `test:` tests only
- `chore:` maintenance/tooling/dependency work
- `perf:` measurable performance improvement
- `build:` build-system changes
- `ci:` CI workflow changes

Good examples:

```text
feat: add attendee registration domain types
feat: add event service abstraction
fix: prevent unsafe renderer URLs
refactor: extract admin navigation config
docs: document payment system boundary
```

Avoid vague messages such as:

```text
updates
changes
fix stuff
final
work
```

## Small-commit rule

A small commit is not necessarily a one-file commit. It is a single logical change.

Prefer:

1. domain contract;
2. service or state implementation;
3. UI integration;
4. tests;
5. docs.

when those pieces can be reviewed independently.

Do not split a change so aggressively that intermediate commits are knowingly broken. Every commit should ideally build, or clearly represent documentation-only/infrastructure scaffolding.

## Verification before PR

From a clean install where practical:

```bash
npm ci
npm run check
```

`npm run check` currently runs lint and production build validation.

For UI changes, additionally verify the relevant flows manually with:

```bash
npm run dev
```

Review at minimum:

- public event pages;
- attendee surfaces if affected;
- admin surfaces if affected;
- mobile/narrow viewport behavior for changed screens;
- keyboard/focus behavior for interactive changes.

## Pull request workflow

Open a PR from:

```text
masterchanges -> main
```

The PR must contain:

- summary;
- scope;
- implementation details that materially affect review;
- validation performed;
- screenshots for visual changes when useful;
- known limitations;
- follow-up tasks that were intentionally excluded.

Do not hide unfinished work in a large PR. If scope grows substantially, stop and split the work into separately reviewable PRs when possible.

## Conflict handling

If `main` changes before the PR is merged:

1. update local `main`;
2. merge or rebase according to maintainer preference;
3. resolve conflicts deliberately;
4. re-run `npm run check`;
5. push the updated `masterchanges` branch.

Never resolve conflicts by blindly choosing `ours` or `theirs` for files containing application logic.

## Upstream fork handling

This repository is a fork. Before bringing upstream changes into the fork, inspect the delta first. Do not overwrite fork-specific work.

A safe pattern is:

```bash
git remote add upstream <upstream-url>   # one time only
git fetch upstream
git checkout main
git merge upstream/main
```

Then reconcile fork-specific changes through normal review.

## Prohibited practices

- direct feature commits to `main`;
- force-pushing `main`;
- committing secrets;
- checking in generated dependency folders such as `node_modules`;
- mixing mass formatting with behavioral changes unless necessary;
- merging a PR without requested review/approval;
- rewriting shared branch history without explicit approval.
