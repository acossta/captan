# Typescript
- NEVER use `any` always use a specific type.

# Git
- NEVER use no-verify
- NEVER commit directly to `main`

# NPM release workflow
Complete steps for releasing a new version:

1. **Create a release branch**: `git checkout -b release/v0.2.3`
2. **Ensure everything is committed** and pushed to the release branch
3. **Bump version and create tag**: `yarn release:patch` (or release:minor | release:major)
   - This runs `npm version patch` which updates package.json and creates a git tag
4. **Push the release branch** with the version bump: `git push origin release/v0.2.3`
5. **Push the tag**: `git push --tags`
6. **Create a PR** from the release branch to main
7. **Wait for CI checks** to pass (monitor GitHub Actions)
   - If CI fails, fix issues and push to the release branch
8. **Merge the PR** to main
9. **CREATE GITHUB RELEASE** (CRITICAL - this triggers npm publish):
   ```bash
   gh release create v0.2.3 --title "v0.2.3 - Title" --notes "Release notes..."
   ```
10. **Verify the release**:
    - Check npm: `npm view captan version`
    - Check GitHub releases page
11. **Clean up**: Delete the release branch

**IMPORTANT**: The npm publish only happens when a GitHub release is created. Merging to main alone does NOT publish to npm.

- NEVER use `npm version` or `npm publish` directly (use yarn commands)
- NEVER skip the GitHub release creation step
- NEVER use `npm patch` - use `yarn release:patch` instead


# Testing
- Use vitest