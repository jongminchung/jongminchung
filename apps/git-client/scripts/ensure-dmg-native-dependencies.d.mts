export interface DmgNativeDependenciesResult {
  readonly bindings?: readonly string[];
  readonly rebuilt?: readonly string[];
  readonly skipped: boolean;
}

interface DmgNativeModule {
  readonly bindingName: string;
  readonly moduleName: string;
  readonly moduleRoot: string;
}

interface DmgNativeDependenciesOptions {
  readonly architecture?: string;
  readonly architectures?: (path: string) => Promise<readonly string[]>;
  readonly build?: (nodeGypScript: string, moduleRoot: string) => Promise<void>;
  readonly modules?: readonly DmgNativeModule[];
  readonly nodeGypScript?: string;
  readonly platform?: string;
}

export function resolveNativeModuleRoot(moduleName: string): string;

export function ensureDmgNativeDependencies(
  options?: DmgNativeDependenciesOptions,
): Promise<DmgNativeDependenciesResult>;
