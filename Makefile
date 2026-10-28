.DEFAULT_GOAL := lint

.PHONY: fmt lint

fmt:
	pnpm exec vp fmt .

lint:
	pnpm exec vp check
