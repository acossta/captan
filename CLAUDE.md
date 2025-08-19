# Typescript
- NEVER use `any` always use a specific type.

# Git
- NEVER use no-verify
- NEVER commit directly to `main`

# NPM release workflow

## Pre-Release Checklist
Before starting a release:
- [ ] All tests pass locally: `yarn test:all`
- [ ] Linting passes: `yarn lint`
- [ ] Type checking passes: `yarn type-check`
- [ ] Test with Node versions matching CI (20 & 22): `nvm use 20 && yarn test:all`
- [ ] Check for uncommitted changes: `git status`
- [ ] Ensure you're on main and up to date: `git checkout main && git pull`

## Release Steps

1. **Create a release branch from main**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/v0.2.3
   # Set upstream immediately to avoid push issues
   git push --set-upstream origin release/v0.2.3
   ```

2. **Update CHANGELOG.md**:
   - Add a new section for the version being released
   - Follow the [Keep a Changelog](https://keepachangelog.com) format
   - Include sections: Added, Changed, Fixed, Removed (as applicable)
   - Example format:
   ```markdown
   ## [0.2.3] - 2025-08-20
   
   ### Added
   - Feature descriptions
   
   ### Fixed
   - Bug fix descriptions
   
   ### Changed
   - Changes to existing functionality
   ```
   - Commit the changelog: `git add CHANGELOG.md && git commit -m "docs: update CHANGELOG for v0.2.3"`

3. **Ensure everything is committed** and pushed to the release branch

4. **Bump version and create tag**:
   ```bash
   # Choose based on semantic versioning:
   yarn release:patch  # Bug fixes (0.2.2 -> 0.2.3)
   yarn release:minor  # New features (0.2.3 -> 0.3.0)
   yarn release:major  # Breaking changes (0.3.0 -> 1.0.0)
   ```
   Note: This creates a git commit and tag automatically

4. **Push the release branch** with the version bump: `git push origin release/v0.2.3`

5. **Push the tag**: `git push --tags`

6. **Create a PR** from the release branch to main

7. **Wait for CI checks** to pass:
   - Monitor: `gh pr checks <PR-NUMBER>`
   - View logs if failed: `gh run view --log-failed`
   - Common issues:
     - Test timeouts: May need to increase timeout in vitest.config.ts
     - Coverage failures: Often external service issues, can be made non-blocking
     - Node version issues: Ensure package.json engines match CI matrix

8. **Merge the PR** to main

9. **CREATE GITHUB RELEASE** (CRITICAL - this triggers npm publish):
   ```bash
   gh release create v0.2.3 --title "v0.2.3 - Brief Description" --notes "$(cat <<'EOF'
   ## What's Changed
   
   ### ✨ Features
   - Feature 1
   - Feature 2
   
   ### 🐛 Bug Fixes
   - Fix 1
   
   ### 🔧 Infrastructure
   - Change 1
   
   ### 📚 Documentation
   - Update 1
   
   **Full Changelog**: https://github.com/acossta/captan/compare/v0.2.2...v0.2.3
   EOF
   )"
   ```

10. **Verify the release**:
    - Check npm: `npm view captan version` (should show new version)
    - Check GitHub: `gh release list --limit 1`
    - Check workflow: `gh run list --workflow=main.yml --limit 1`
    - Test installation: `npx captan@latest --version`
    - Monitor npm publish workflow: `gh run watch`

11. **Clean up**:
    ```bash
    git checkout main
    git pull origin main
    git branch -d release/v0.2.3  # Delete local branch
    git push origin --delete release/v0.2.3  # Delete remote branch
    ```

**IMPORTANT**: The npm publish only happens when a GitHub release is created. Merging to main alone does NOT publish to npm.

- NEVER use `npm version` or `npm publish` directly (use yarn commands)
- NEVER skip the GitHub release creation step
- NEVER use `npm patch` - use `yarn release:patch` instead

## Troubleshooting

### Release workflow not triggered
- Ensure GitHub release is created (not just draft)
- Check workflow permissions in repo settings

### npm publish failed
- Check NPM_TOKEN secret is set in GitHub
- Verify package.json has correct name and version
- Check npm account has publish permissions

### Tests pass locally but fail in CI
- Check Node.js version: CI uses 20 & 22
- Increase test timeout for slower CI runners
- Clear test artifacts between runs

### Tag already exists error
- Delete local tag: `git tag -d v0.2.3`
- Delete remote tag: `git push origin --delete v0.2.3`
- Recreate with yarn release command

## Rollback Procedure
If something goes wrong after publishing:
1. **npm deprecate** the broken version: `npm deprecate captan@0.2.3 "Contains critical bug"`
2. Create a patch release with the fix
3. Update GitHub release notes to mention the issue
4. DO NOT unpublish from npm (breaks dependency chains)


# Testing
- Use vitest