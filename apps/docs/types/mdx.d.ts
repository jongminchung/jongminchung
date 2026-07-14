declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MdxContent: ComponentType;
  export const metadata: unknown;
  export default MdxContent;
}
