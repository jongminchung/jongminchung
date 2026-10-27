.DEFAULT_GOAL := lint

.PHONY: fmt lint

fmt:
	pnpm exec vp fmt .
	node scripts/style-shell.ts write

lint:
	pnpm exec vp check
	node scripts/style-shell.ts check
