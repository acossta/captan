# Typescript
- NEVER use `any` always use a specific type.

# Git
- NEVER use no-verify
- NEVER commit directly to `main`

# NPM release workflow
- Create a branch for the release like `release/0.2.3`
- Everything needs to be committed and pushed.
- Use yarn release:patch | release:minor | release:mayor.
- NEVER use `npm patch` or `npm publish` directly.
- Monitor the github actions logs for `CI` and `Release to npm`
  - If they fail, fix the issues.
- Create a PR for the release
- Merge the PR into main, delete the branch


# Testing
- Use vitest