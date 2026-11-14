# Design CI/CD for a Large Frontend Monorepo

A company has moved its frontend code into one monorepo: several web apps, a browser extension, a design system, and dozens of shared libraries, worked on by hundreds of engineers. CI used to run every build and test on every pull request, and now takes over an hour. Design the CI/CD system that keeps it fast and keeps `main` green.

- **In scope:** what runs on each pull request, how only the affected work is built and tested, caching, the path from approved PR to `main`, flaky tests, code ownership and required reviews, and deploying each app independently.
- **Out of scope:** the choice of version control host and the internals of the build tools themselves (you can assume a build tool that understands the package dependency graph).

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about the size of the repo, PR volume, test times, and release process. The interviewer has the numbers.
2. **Estimate** CI load: builds per hour, compute minutes, and cache size.
3. **Design the system**: the pipeline from push to merge to deploy, and the services behind it.
4. **Go deep** on the hardest parts, such as affected-graph computation, remote caching that is safe to share, keeping `main` green with a merge queue, and flaky tests.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.
