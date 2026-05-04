.PHONY: check check-release fix format lint test build build-cold release

check: format lint test

check-release: check
	npm run test:release

fix:
	npm run format:fix

format:
	npm run format

lint:
	npm run lint

test:
	npm test

build:
	npm run build

build-cold:
	npm run build:cold

# Lint, bump version, update CHANGELOG, commit, tag, push, publish to npm.
# Usage: make release          (defaults to patch)
#        make release LEVEL=minor|major
LEVEL ?= patch
release:
	@set -e; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "WARNING: Uncommitted changes detected — these will NOT be included in the release:"; \
		git status --short; \
		echo ""; \
	fi; \
	eval $$(ssh-agent -s); trap "ssh-agent -k > /dev/null" EXIT; \
	ssh-add; \
	npm whoami > /dev/null 2>&1 || npm login; \
	echo "npm user: $$(npm whoami) | $$(date '+%Y-%m-%d %H:%M:%S %Z')"; \
	$(MAKE) format; $(MAKE) lint; \
	$(MAKE) test; \
	npm run test:release; \
	npm version $(LEVEL) --no-git-tag-version; \
	git-cliff --tag "v$$(node -p 'require("./package.json").version')" --output CHANGELOG.md; \
	git add package.json package-lock.json CHANGELOG.md; \
	git commit -m "Release $$(node -p 'require("./package.json").version')"; \
	git tag "v$$(node -p 'require("./package.json").version')"; \
	git push; git push --tags; \
	npm publish --access public
