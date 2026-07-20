import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useId, useRef } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

interface InputStatus {
  readonly type: "error" | "success" | "warning";
  readonly message?: string;
}

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly isLabelHidden?: boolean;
  readonly description?: string;
  readonly isOptional?: boolean;
  readonly isRequired?: boolean;
  readonly status?: InputStatus;
  readonly width?: number | string;
  readonly children: ReactNode;
  readonly className?: string;
}

function FieldShell({
  id,
  label,
  isLabelHidden = false,
  description,
  isOptional = false,
  isRequired = false,
  status,
  width,
  children,
  className,
}: FieldShellProps): ReactNode {
  return (
    <label className={cn("grid min-w-0 gap-1 text-xs", className)} htmlFor={id} style={{ width }}>
      <span className={cn("font-medium", isLabelHidden && "sr-only")}>
        {label}
        {isOptional ? (
          <small className="ml-1 font-normal text-muted-foreground">Optional</small>
        ) : null}
      </span>
      {description ? <small className="text-muted-foreground">{description}</small> : null}
      {children}
      {status?.message ? (
        <small
          className={status.type === "error" ? "text-destructive" : "text-muted-foreground"}
          role={status.type === "error" ? "alert" : undefined}
        >
          {status.message}
        </small>
      ) : null}
      {isRequired ? <span className="sr-only">Required</span> : null}
    </label>
  );
}

interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size" | "value"
> {
  readonly label: string;
  readonly value: string;
  readonly onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  readonly changeAction?: (
    value: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => void | Promise<void>;
  readonly isLabelHidden?: boolean;
  readonly description?: string;
  readonly isOptional?: boolean;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  readonly disabledMessage?: string;
  readonly startIcon?: ReactNode;
  readonly status?: InputStatus;
  readonly placeholder?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly isLoading?: boolean;
  readonly width?: number | string;
  readonly labelTooltip?: string;
  readonly hasClear?: boolean;
  readonly hasAutoFocus?: boolean;
  readonly htmlName?: string;
  readonly onEnter?: () => void;
  readonly ref?: Ref<HTMLInputElement>;
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  changeAction,
  isLabelHidden,
  description,
  isOptional,
  isRequired,
  isDisabled = false,
  disabledMessage,
  startIcon,
  status,
  placeholder,
  size = "md",
  isLoading = false,
  width,
  labelTooltip,
  hasClear = false,
  hasAutoFocus = false,
  htmlName,
  onEnter,
  ref,
  className,
  onKeyDown,
  ...props
}: TextInputProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange?.(event.target.value, event);
    if (!event.defaultPrevented && changeAction) void changeAction(event.target.value, event);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    if (!event.defaultPrevented && event.key === "Enter") onEnter?.();
  };
  return (
    <FieldShell
      description={description}
      id={inputId}
      isLabelHidden={isLabelHidden}
      isOptional={isOptional}
      isRequired={isRequired}
      label={label}
      status={status}
      width={width}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-background px-2 text-foreground shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
          size === "sm" ? "h-7" : size === "lg" ? "h-9" : "h-8",
          status?.type === "error" && "border-destructive",
          isDisabled && "opacity-50",
          className,
        )}
        title={disabledMessage ?? labelTooltip}
      >
        {startIcon ?? <Search aria-hidden className="hidden size-3.5 text-muted-foreground" />}
        <input
          autoFocus={hasAutoFocus}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          disabled={isDisabled}
          id={inputId}
          name={htmlName}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={isDisabled && disabledMessage !== undefined}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref !== null && ref !== undefined) ref.current = node;
          }}
          required={isRequired}
          value={value}
          {...props}
        />
        {isLoading ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : null}
        {hasClear && value ? (
          <button
            aria-label={`Clear ${label}`}
            className="grid size-5 place-items-center rounded-sm hover:bg-accent"
            onClick={() => {
              const input = inputRef.current;
              if (input === null) return;
              const event = new Event("input", { bubbles: true });
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
                input,
                "",
              );
              input.dispatchEvent(event);
              input.focus();
            }}
            type="button"
          >
            <X aria-hidden className="size-3" />
          </button>
        ) : null}
      </span>
    </FieldShell>
  );
}

interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> {
  readonly label: string;
  readonly value: string;
  readonly onChange?: (value: string, event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly changeAction?: (
    value: string,
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => void | Promise<void>;
  readonly isLabelHidden?: boolean;
  readonly description?: string;
  readonly isOptional?: boolean;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  readonly disabledMessage?: string;
  readonly status?: InputStatus;
  readonly width?: number | string;
  readonly labelTooltip?: string;
  readonly startIcon?: ReactNode;
  readonly hasSpellCheck?: boolean;
  readonly hasAutoFocus?: boolean;
  readonly htmlName?: string;
  readonly isLoading?: boolean;
  readonly size?: "sm" | "md" | "lg";
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  changeAction,
  isLabelHidden,
  description,
  isOptional,
  isRequired,
  isDisabled = false,
  disabledMessage,
  status,
  width,
  labelTooltip,
  startIcon,
  hasSpellCheck = true,
  hasAutoFocus = false,
  htmlName,
  isLoading = false,
  className,
  ...props
}: TextAreaProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell
      description={description}
      id={inputId}
      isLabelHidden={isLabelHidden}
      isOptional={isOptional}
      isRequired={isRequired}
      label={label}
      status={status}
      width={width}
    >
      <span className="relative flex">
        {startIcon ? (
          <span className="absolute left-2 top-2 text-muted-foreground">{startIcon}</span>
        ) : null}
        <textarea
          autoFocus={hasAutoFocus}
          className={cn(
            "min-h-20 w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
            startIcon && "pl-8",
            status?.type === "error" && "border-destructive",
            className,
          )}
          disabled={isDisabled}
          id={inputId}
          name={htmlName}
          onChange={(event) => {
            onChange?.(event.target.value, event);
            if (!event.defaultPrevented && changeAction)
              void changeAction(event.target.value, event);
          }}
          readOnly={isDisabled && disabledMessage !== undefined}
          required={isRequired}
          spellCheck={hasSpellCheck}
          title={disabledMessage ?? labelTooltip}
          value={value}
          {...props}
        />
        {isLoading ? (
          <LoaderCircle aria-hidden className="absolute right-2 top-2 size-3.5 animate-spin" />
        ) : null}
      </span>
    </FieldShell>
  );
}

interface CheckboxInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size" | "value"
> {
  readonly label: ReactNode;
  readonly value: boolean | "indeterminate";
  readonly onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  readonly isLabelHidden?: boolean;
  readonly description?: string;
  readonly isDisabled?: boolean;
  readonly disabledMessage?: string;
  readonly isReadOnly?: boolean;
  readonly size?: "sm" | "md";
  readonly width?: number | string;
  readonly labelIcon?: ReactNode;
  readonly status?: InputStatus;
  readonly htmlName?: string;
}

export function CheckboxInput({
  label,
  value,
  onChange,
  isLabelHidden = false,
  description,
  isDisabled = false,
  disabledMessage,
  isReadOnly = false,
  size = "md",
  width,
  labelIcon,
  status,
  htmlName,
  className,
  ...props
}: CheckboxInputProps): ReactNode {
  return (
    <label
      className={cn(
        "flex items-start gap-2 text-xs",
        size === "sm" ? "min-h-7" : "min-h-8",
        className,
      )}
      style={{ width }}
      title={disabledMessage}
    >
      <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center">
        <input
          checked={value === true}
          className="peer size-4 appearance-none rounded border border-input bg-background shadow-xs outline-none checked:border-primary checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring/45 disabled:opacity-50"
          disabled={isDisabled}
          name={htmlName}
          onChange={(event) => {
            if (!isReadOnly) onChange?.(event.target.checked, event);
          }}
          readOnly={isReadOnly}
          type="checkbox"
          {...props}
        />
        {value === true || value === "indeterminate" ? (
          <Check
            aria-hidden
            className="pointer-events-none absolute size-3 text-primary-foreground"
          />
        ) : null}
      </span>
      <span className={cn("grid min-w-0 gap-0.5", isLabelHidden && "sr-only")}>
        <span className="flex items-center gap-1.5">
          {labelIcon}
          {label}
        </span>
        {description ? <small className="text-muted-foreground">{description}</small> : null}
        {status?.message ? <small className="text-destructive">{status.message}</small> : null}
      </span>
    </label>
  );
}

interface SelectorOption {
  readonly value: string;
  readonly label: string;
  readonly isDisabled?: boolean;
}

interface SelectorProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "size" | "value"
> {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectorOption[];
  readonly onChange?: (value: string) => void;
  readonly isLabelHidden?: boolean;
  readonly isDisabled?: boolean;
  readonly width?: number | string;
  readonly size?: "sm" | "md" | "lg";
  readonly placement?: string;
  readonly hasSearch?: boolean;
  readonly isLoading?: boolean;
  readonly labelTooltip?: string;
  readonly status?: InputStatus;
  readonly placeholder?: string;
}

export function Selector({
  id: suppliedId,
  label,
  value,
  options,
  onChange,
  isLabelHidden = false,
  isDisabled = false,
  width,
  size = "md",
  placement: _placement,
  hasSearch: _hasSearch,
  isLoading: _isLoading,
  labelTooltip,
  status,
  placeholder,
  className,
  ...props
}: SelectorProps): ReactNode {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <label className="grid gap-1 text-xs" htmlFor={id} style={{ width }}>
      <span className={cn("font-medium", isLabelHidden && "sr-only")} title={labelTooltip}>
        {label}
      </span>
      <span className="relative flex">
        <select
          className={cn(
            "w-full appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-xs shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
            size === "sm" ? "h-7" : size === "lg" ? "h-9" : "h-8",
            className,
            status?.type === "error" && "border-destructive",
          )}
          disabled={isDisabled}
          id={id}
          onChange={(event) => onChange?.(event.target.value)}
          value={value}
          {...props}
        >
          {placeholder && !options.some((option) => option.value === "") ? (
            <option disabled value="">
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option disabled={option.isDisabled} key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}

export function FieldStatus({
  message,
  type,
}: {
  readonly message: string;
  readonly type: InputStatus["type"];
  readonly variant?: string;
}): ReactNode {
  return (
    <p
      className={cn("m-0 text-xs", type === "error" ? "text-destructive" : "text-muted-foreground")}
      role={type === "error" ? "alert" : undefined}
    >
      {message}
    </p>
  );
}
