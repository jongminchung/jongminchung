import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useDismissLayer } from "./CommandProvider";
import { Dialog, DialogHeader } from "./ProductDialog";
import { FieldStatus } from "./ProductFormControls";
import { TextInput } from "./ProductFormControls";

interface InputOptions {
  readonly title: string;
  readonly label: string;
  readonly description?: string;
  readonly initialValue?: string;
  readonly placeholder?: string;
  readonly allowEmpty?: boolean;
  readonly confirmLabel?: string;
  readonly validate?: (value: string) => string | null;
}

interface ConfirmOptions {
  readonly title: string;
  readonly description: string;
  readonly impact?: string;
  readonly confirmLabel?: string;
  readonly dangerous?: boolean;
}

type DialogRequest =
  | {
      readonly kind: "input";
      readonly options: InputOptions;
      readonly resolve: (value: string | null) => void;
    }
  | {
      readonly kind: "confirm";
      readonly options: ConfirmOptions;
      readonly resolve: (value: boolean) => void;
    };

export interface AppDialogController {
  readonly input: (options: InputOptions) => Promise<string | null>;
  readonly confirm: (options: ConfirmOptions) => Promise<boolean>;
  readonly node: ReactNode;
}

export function useAppDialog(): AppDialogController {
  const [request, setRequest] = useState<DialogRequest>();
  const [value, setValue] = useState("");
  const [validation, setValidation] = useState<string>();
  const requestRef = useRef<DialogRequest | undefined>(undefined);
  const originFocus = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  requestRef.current = request;

  useEffect(() => {
    if (request?.kind !== "confirm") return;
    const target = request.options.dangerous
      ? cancelButtonRef.current
      : confirmButtonRef.current;
    target?.focus();
  }, [request]);

  useEffect(
    () => () => {
      const pending = requestRef.current;
      if (pending?.kind === "input") pending.resolve(null);
      if (pending?.kind === "confirm") pending.resolve(false);
    },
    [],
  );

  const input = useCallback((options: InputOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      originFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setValue(options.initialValue ?? "");
      setValidation(undefined);
      setRequest({ kind: "input", options, resolve });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      originFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setValidation(undefined);
      setRequest({ kind: "confirm", options, resolve });
    });
  }, []);

  const cancel = useCallback((): void => {
    if (request?.kind === "input") request.resolve(null);
    if (request?.kind === "confirm") request.resolve(false);
    setRequest(undefined);
    window.requestAnimationFrame(() => {
      if (originFocus.current?.isConnected) originFocus.current.focus();
    });
  }, [request]);

  const submit = (): void => {
    if (!request) return;
    if (request.kind === "input") {
      const result = value.trim();
      if (!request.options.allowEmpty && !result) {
        setValidation(`${request.options.label} is required.`);
        return;
      }
      const message = request.options.validate?.(result) ?? null;
      if (message !== null) {
        setValidation(message);
        return;
      }
      request.resolve(result);
    } else {
      request.resolve(true);
    }
    setRequest(undefined);
    window.requestAnimationFrame(() => {
      if (originFocus.current?.isConnected) originFocus.current.focus();
    });
  };

  useDismissLayer(
    useMemo(
      () => ({
        id: `app-dialog-${dialogId}`,
        priority: 140,
        active: request !== undefined,
        dismiss: cancel,
      }),
      [dialogId, request, cancel],
    ),
  );

  const node = request ? (
    <Dialog
      aria-label={request.options.title}
      isOpen
      maxHeight="80vh"
      onOpenChange={(isOpen) => {
        if (!isOpen) cancel();
      }}
      padding={0}
      purpose="form"
      width={520}
    >
      <form
        className="flex min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(isOpen) => {
            if (!isOpen) cancel();
          }}
          title={request.options.title}
        />
        <div className="grid min-h-0 gap-3 overflow-auto p-4">
          {request.options.description && (
            <p className="m-0 leading-5 text-muted-foreground">
              {request.options.description}
            </p>
          )}
          {request.kind === "input" ? (
            <TextInput
              hasAutoFocus
              isRequired={!request.options.allowEmpty}
              label={request.options.label}
              onChange={(nextValue) => {
                setValue(nextValue);
                setValidation(undefined);
              }}
              placeholder={request.options.placeholder}
              status={
                validation ? { type: "error", message: validation } : undefined
              }
              value={value}
              width="100%"
            />
          ) : request.options.impact ? (
            <pre className="m-0 max-h-48 overflow-auto rounded-md border border-border bg-muted p-3 whitespace-pre-wrap text-muted-foreground">
              {request.options.impact}
            </pre>
          ) : null}
          {validation && request.kind !== "input" && (
            <FieldStatus message={validation} type="error" />
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border p-3">
          <Button
            onClick={cancel}
            ref={cancelButtonRef}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            ref={confirmButtonRef}
            type="submit"
            className={cn(
              "h-7 px-2.5",
              request.kind === "confirm" && request.options.dangerous ? "" : "",
            )}
            variant={
              request.kind === "confirm" && request.options.dangerous
                ? "destructive"
                : "default"
            }
            size="sm"
          >
            {request.options.confirmLabel ??
              (request.kind === "confirm" ? "Continue" : "Apply")}
          </Button>
        </footer>
      </form>
    </Dialog>
  ) : null;

  return { input, confirm, node };
}
