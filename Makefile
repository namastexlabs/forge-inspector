PNPM ?= pnpm
NPM_OTP ?=

.PHONY: publish check-clean npm-auth lint version

check-clean:
	@git diff --quiet && git diff --cached --quiet || (echo "Working tree is dirty. Commit or stash changes before publishing."; exit 1)

npm-auth:
	@npm whoami >/dev/null 2>&1 || (echo "Not logged in to npm. Run 'npm login' or export NPM_TOKEN."; exit 1)

lint:
	$(PNPM) lint

version:
	$(PNPM) changeset version
	$(PNPM) install

publish: check-clean npm-auth lint version
	NPM_CONFIG_OTP=$(NPM_OTP) $(PNPM) release
