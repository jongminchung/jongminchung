.DEFAULT_GOAL := lint

BUN ?= bun

.PHONY: fmt lint

fmt:
	$(BUN) run fmt

lint:
	$(BUN) run fmt:check
	$(BUN) run lint
