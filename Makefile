PNPM ?= pnpm

.PHONY: publish publish-promote publish-nightly publish-local check-clean npm-auth lint dev build

# Development
dev:
	$(PNPM) dev

build:
	$(PNPM) build

lint:
	$(PNPM) lint

# Pre-publish checks
check-clean:
	@git diff --quiet && git diff --cached --quiet || (echo "Working tree is dirty. Commit or stash changes before publishing."; exit 1)

npm-auth:
	@npm whoami >/dev/null 2>&1 || (echo "Not logged in to npm. Run 'npm login' or export NPM_TOKEN."; exit 1)

# Release via GitHub Actions (recommended)
publish:
	@echo "🚀 Triggering release workflow (bump-rc)..."
	gh workflow run release.yml -f action=bump-rc
	@echo "✅ Workflow triggered. Monitor at: https://github.com/namastexlabs/forge-inspector/actions"

publish-promote:
	@echo "🎉 Triggering release workflow (promote to stable)..."
	gh workflow run release.yml -f action=promote
	@echo "✅ Workflow triggered. Monitor at: https://github.com/namastexlabs/forge-inspector/actions"

publish-nightly:
	@echo "🌙 Triggering release workflow (nightly)..."
	gh workflow run release.yml -f action=nightly
	@echo "✅ Workflow triggered. Monitor at: https://github.com/namastexlabs/forge-inspector/actions"

# Local release (for testing/emergencies)
publish-local: check-clean npm-auth lint
	@echo "⚠️  Publishing locally (use 'make publish' for normal releases)"
	node scripts/unified-release.cjs --action bump-rc
	git push && git push --tags
	cd packages/forge-inspector && npm publish --access public

# Dry run (test release without making changes)
dry-run:
	node scripts/unified-release.cjs --action bump-rc --dry-run
