export const upstreamMaterialNotice =
  "// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.";

export const appOwnedMaterialFiles = [
  "building-email-relay-system/ReplyParserDemo.tsx",
  "building-email-relay-system/TokenAnatomyDemo.tsx",
  "frontend-caching-strategies/StaleTimeSessionDemo.tsx",
  "frontend-caching-strategies/TagInvalidationDemo.tsx",
  "react-component-based-thinking/StateMachineDemo.tsx",
  "the-expensive-main-thread/LongTaskBlockingDemo.tsx",
  "the-expensive-main-thread/TransformVsLayoutDemo.tsx",
] as const;

export const appOwnedMaterialFileSet = new Set<string>(appOwnedMaterialFiles);
