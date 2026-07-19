import type { Extension } from "@codemirror/state";

export async function languageExtensionForPath(path: string): Promise<Extension | null> {
  const extension = path.split(".").pop()?.toLocaleLowerCase();
  if (extension === "ts" || extension === "tsx" || extension === "js" || extension === "jsx") {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript({
      jsx: extension === "tsx" || extension === "jsx",
      typescript: extension === "ts" || extension === "tsx",
    });
  }
  if (extension === "json" || extension === "jsonc") {
    return (await import("@codemirror/lang-json")).json();
  }
  if (extension === "css" || extension === "scss" || extension === "less") {
    return (await import("@codemirror/lang-css")).css();
  }
  if (extension === "html" || extension === "htm") {
    return (await import("@codemirror/lang-html")).html();
  }
  if (extension === "java") return (await import("@codemirror/lang-java")).java();
  if (extension === "py") return (await import("@codemirror/lang-python")).python();
  return null;
}
