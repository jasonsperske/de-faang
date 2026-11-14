# Design CI/CD for a Large Frontend Monorepo

**Type:** System design · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `system-design` `developer-platform` `ci-cd` `caching` `build-systems`

A company has moved its frontend code into one monorepo: several web apps, a browser extension, a design system, and dozens of shared libraries, worked on by hundreds of engineers. CI used to run every build and test on every pull request, and now takes over an hour. Design the CI/CD system that keeps it fast and keeps `main` green.

Full prompt: [prompt.md](prompt.md).

## How it's graded

Rubric: [`system-design`](../../../rubrics/README.md#system-design) (System design interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Requirements & scoping | 20% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)<br>[Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |
| High-level design | 25% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Deep dive & technical depth | 25% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) |
| Scalability, reliability & tradeoffs | 20% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[Google SRE Book](https://sre.google/sre-book/table-of-contents/)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Communication & leadership | 10% | [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Strong answers make the dependency graph the centre of the design: compute what a change affects, run only that, and never redo work whose inputs haven't changed. Requirements: PR feedback p50 under 10 minutes, p95 under 20; main always green; required reviews from code owners per package; independent deploys per app; reproducible builds. Estimates: 1,500 PRs/week plus ~5 pushes per PR is ~7,500 pipeline runs/week, ~200/hour at peak; full build+test is ~4 hours of compute (parallelised to 60+ minutes), so running everything costs ~30,000 compute hours/week; with affected-only plus caching, typical PRs touch 5-10% of packages. Pipeline: on push, a planner checks out the merge commit, determines changed files, maps them to packages (plus global inputs such as lockfile, root configs and toolchain versions, which invalidate everything or a defined subset), computes the affected set via reverse dependencies in the package graph, and expands it into a DAG of tasks (lint, typecheck, build, unit test, e2e) per package. Tasks run on an autoscaled runner pool, distributed by DAG order with test sharding by historical duration. Remote cache: content-addressed by a hash of all task inputs (source files, dependency outputs' hashes, toolchain, env vars, command); outputs stored in object storage behind a cache service; CI writes, developers read only (or writes signed and scoped) to prevent poisoning; hermeticity checks to catch undeclared inputs. Merge queue: approved PRs enter a queue; the system tests speculative merges (main + PR1, main + PR1 + PR2, ...) in parallel, merges the passing prefix, and evicts failures, so main is never broken by semantic conflicts. Flaky tests: record results per test over time, auto-retry once and flag if pass-on-retry, quarantine tests above a flakiness threshold (non-blocking but still run and reported), file tickets to the owning team from CODEOWNERS, and track a flake budget. Ownership: CODEOWNERS per package path, required reviewers enforced by the host's branch protection, ownership metadata also used for alert routing. Deploys: each app has a pipeline triggered when main changes affect it; build once, promote the same artifact through staging, canary and production; web apps deploy continuously with feature flags and automatic rollback on error-rate regressions; the extension builds a versioned release candidate on a cadence, submits it to the stores, and uses remote config / staged rollouts since store rollbacks are slow. Observability: CI dashboards for queue time, p50/p95 duration, cache hit rate, flake rate, cost per PR.

**Common pitfalls**

- Running the whole build and test suite on every PR, only with more machines.
- Determining affected packages from changed directories alone, ignoring transitive dependents and global inputs such as the lockfile or shared configs.
- Cache keys based on branch names, timestamps or a subset of inputs, which serves stale or wrong artifacts.
- Letting any machine write to the shared cache without integrity controls.
- Testing PRs against an old main and merging without a merge queue, so main breaks on semantic conflicts.
- Retrying flaky tests silently until they pass, which hides real failures and never gets them fixed.
- Rebuilding artifacts separately for each environment instead of promoting one build.
- Treating the browser extension like a web app with instant rollback.

**Likely deep dives**

- Affected-graph computation: mapping changed files to packages, transitive dependents and global inputs
- Content-addressed remote caching: cache keys, hermeticity and protection against poisoning
- Merge queue with speculative batches to keep main green
- Flaky test detection, quarantine and ownership
- Independent deploys: build once, promote, canary, and the extension's store release train

</details>

## Follow-up questions

Asked in writing after you submit.

- A PR changes one file in a utility library that 40 packages depend on. Walk through exactly what CI computes and runs, and what is served from cache.
- Two PRs each pass CI on their own, merge within a minute of each other, and break main together. How does your design prevent that, and what does it cost in merge latency?
- A developer's laptop uploads a poisoned artifact to the remote cache. How do you make the cache safe to share between CI and developers, and what makes a cache key correct?
- A test fails 2% of the time for reasons unrelated to the change. How does your system detect it, keep it from blocking merges, and get it fixed rather than ignored forever?
- The browser extension must go through store review, while the web apps deploy continuously. How does the same pipeline handle both, and how do you roll back each?

## Study resources

- [Bazel — Remote caching](https://bazel.build/remote/caching)
- [Potvin & Levenberg — Why Google stores billions of lines of code in a single repository (CACM)](https://cacm.acm.org/magazines/2016/7/204032-why-google-stores-billions-of-lines-of-code-in-a-single-repository/fulltext)
- [Wikipedia — Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)
- [Martin Fowler — Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html)
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
