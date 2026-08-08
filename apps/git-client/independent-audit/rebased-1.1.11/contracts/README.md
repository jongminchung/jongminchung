# Rebased 1.1.11 UI contract

This directory defines how observations from the installed Rebased 1.1.11 app are recorded and
where each observation maps into the current Git Client implementation.

## Authority

- A reference value is authoritative only when `source.product` is `Rebased`,
  `source.version` is `1.1.11`, and the referenced evidence has a verified SHA-256 digest.
- README screenshots may explain intent but cannot populate an `actual-app` measurement.
- Existing parity documents, stored completion percentages, fixture snapshots, and tests whose
  expectations were authored by Git Client are never reference evidence.
- `implementation.tests` entries are coverage locations only. They do not prove equivalence.

## Capture procedure

1. Start Rebased with an isolated profile and the fixture named by the surface contract.
2. Set the exact viewport and repository precondition before opening the surface.
3. Capture a lossless screenshot, accessibility-tree export, and interaction observation.
4. Record bounds in screen pixels with the top-left screen origin. Record colors as 8-digit sRGB
   hex (`#rrggbbaa`) and text exactly as exposed by accessibility APIs.
5. Walk keyboard focus from the contract's `startAt`; record every Tab and Shift+Tab stop. Press
   Escape once per layer and record the dismissed layer plus restored focus.
6. For destructive or history-changing actions, stop at the confirmation surface. Never execute
   the operation merely to measure the UI.
7. Add each artifact to the evidence manifest, compute SHA-256, then change the measurement state
   from `pending` to `observed`.

`surface-contracts.json` is intentionally pending until actual Rebased evidence is captured. Run:

```sh
node independent-audit/rebased-1.1.11/contracts/validate-contracts.mjs
node --test independent-audit/rebased-1.1.11/contracts/validate-contracts.node-test.mjs
```
