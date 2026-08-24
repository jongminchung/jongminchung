declare module "remark-kroki" {
  interface RemarkKrokiOptions {
    readonly alias?: readonly string[];
    readonly output?: string;
    readonly server?: string;
    readonly target?: string;
  }

  export function remarkKroki(options?: RemarkKrokiOptions): void;
}
