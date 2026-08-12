import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@jongminchung/ui/components/field";
import { Input } from "@jongminchung/ui/components/input";
import { Spinner as SpinnerIcon } from "@jongminchung/ui/components/spinner";
import { Textarea } from "@jongminchung/ui/components/textarea";
import { cn } from "@jongminchung/ui/lib/utils";
import { Search, X } from "lucide-react";
import { useId, useRef } from "react";
import type {
  ChangeEvent,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ProductSelect";

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
  const descriptionId = description === undefined ? undefined : `${id}-description`;
  const statusId = status?.message === undefined ? undefined : `${id}-status`;
  return (
    <Field
      className={cn("min-w-0 gap-1 text-xs", className)}
      data-invalid={status?.type === "error" || undefined}
      style={{ width }}
    >
      <FieldLabel className={cn("font-medium", isLabelHidden && "sr-only")} htmlFor={id}>
        {label}
        {isOptional ? (
          <small className="ml-1 font-normal text-muted-foreground">Optional</small>
        ) : null}
      </FieldLabel>
      {description ? (
        <FieldDescription className="text-xs" id={descriptionId}>
          {description}
        </FieldDescription>
      ) : null}
      {children}
      {status?.message ? (
        <FieldError
          className={status.type === "error" ? "text-destructive" : "text-muted-foreground"}
          id={statusId}
          role={status.type === "error" ? "alert" : "status"}
        >
          {status.message}
        </FieldError>
      ) : null}
      {isRequired ? <span className="sr-only">Required</span> : null}
    </Field>
  );
}

function fieldDescriptionIds(
  id: string,
  description: string | undefined,
  status: InputStatus | undefined,
): string | undefined {
  const ids = [
    description === undefined ? undefined : `${id}-description`,
    status?.message === undefined ? undefined : `${id}-status`,
  ].filter((value): value is string => value !== undefined);
  return ids.length === 0 ? undefined : ids.join(" ");
}

interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size" | "value"
> {
  readonly label: string;
  readonly value: string;
  readonly onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
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
  readonly ref?: Ref<HTMLInputElement>;
}

export function TextInput({
  id,
  label,
  value,
  onChange,
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
  ref,
  className,
  onKeyDown,
  ...props
}: TextInputProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
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
        aria-busy={isLoading || undefined}
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
        <Input
          aria-describedby={fieldDescriptionIds(inputId, description, status)}
          aria-invalid={status?.type === "error" || undefined}
          autoFocus={hasAutoFocus}
          className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
          disabled={isDisabled}
          id={inputId}
          onChange={(event) => onChange?.(event.target.value, event)}
          onKeyDown={onKeyDown}
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
        {isLoading ? <SpinnerIcon aria-hidden className="size-3.5" /> : null}
        {hasClear && value ? (
          <Button
            aria-label={`Clear ${label}`}
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
            className="size-5"
            size="icon-xs"
            variant="ghost"
          >
            <X aria-hidden className="size-3" />
          </Button>
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
  readonly isLoading?: boolean;
  readonly size?: "sm" | "md" | "lg";
  readonly fieldClassName?: string;
}

export function TextArea({
  id,
  label,
  value,
  onChange,
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
  isLoading = false,
  fieldClassName,
  className,
  ...props
}: TextAreaProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell
      className={fieldClassName}
      description={description}
      id={inputId}
      isLabelHidden={isLabelHidden}
      isOptional={isOptional}
      isRequired={isRequired}
      label={label}
      status={status}
      width={width}
    >
      <span aria-busy={isLoading || undefined} className="relative flex">
        {startIcon ? (
          <span className="absolute left-2 top-2 text-muted-foreground">{startIcon}</span>
        ) : null}
        <Textarea
          aria-describedby={fieldDescriptionIds(inputId, description, status)}
          aria-invalid={status?.type === "error" || undefined}
          autoFocus={hasAutoFocus}
          className={cn(
            "min-h-20 w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
            startIcon && "pl-8",
            status?.type === "error" && "border-destructive",
            className,
          )}
          disabled={isDisabled}
          id={inputId}
          onChange={(event) => onChange?.(event.target.value, event)}
          readOnly={isDisabled && disabledMessage !== undefined}
          required={isRequired}
          spellCheck={hasSpellCheck}
          title={disabledMessage ?? labelTooltip}
          value={value}
          {...props}
        />
        {isLoading ? <SpinnerIcon aria-hidden className="absolute top-2 right-2 size-3.5" /> : null}
      </span>
    </FieldShell>
  );
}

interface CheckboxInputProps extends Omit<
  ComponentProps<typeof Checkbox>,
  "checked" | "onCheckedChange" | "size" | "value"
> {
  readonly label: ReactNode;
  readonly value: boolean | "indeterminate";
  readonly onChange?: (checked: boolean, event: Event) => void;
  readonly isLabelHidden?: boolean;
  readonly description?: string;
  readonly isDisabled?: boolean;
  readonly disabledMessage?: string;
  readonly isReadOnly?: boolean;
  readonly size?: "sm" | "md";
  readonly width?: number | string;
  readonly labelIcon?: ReactNode;
  readonly status?: InputStatus;
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
  className,
  id: suppliedId,
  required,
  ...props
}: CheckboxInputProps): ReactNode {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const descriptionId = description === undefined ? undefined : `${id}-description`;
  const statusId = status?.message === undefined ? undefined : `${id}-status`;
  return (
    <Field
      className={cn(
        "flex-row items-start gap-2 text-xs",
        size === "sm" ? "min-h-7" : "min-h-8",
        className,
      )}
      data-invalid={status?.type === "error" || undefined}
      style={{ width }}
      title={disabledMessage}
    >
      <Checkbox
        {...props}
        aria-describedby={[descriptionId, statusId].filter(Boolean).join(" ") || undefined}
        aria-invalid={status?.type === "error" || undefined}
        checked={value === true}
        className="mt-0.5"
        disabled={isDisabled}
        id={id}
        indeterminate={value === "indeterminate"}
        onCheckedChange={(checked, eventDetails) => {
          if (!isReadOnly) onChange?.(checked, eventDetails.event);
        }}
        readOnly={isReadOnly}
        required={required}
      />
      <FieldLabel className={cn("grid min-w-0 gap-0.5", isLabelHidden && "sr-only")} htmlFor={id}>
        <span className="flex items-center gap-1.5">
          {labelIcon}
          {label}
        </span>
        {description ? (
          <FieldDescription className="text-xs" id={descriptionId}>
            {description}
          </FieldDescription>
        ) : null}
        {status?.message ? <FieldError id={statusId}>{status.message}</FieldError> : null}
      </FieldLabel>
    </Field>
  );
}

interface SelectorOption {
  readonly value: string;
  readonly label: string;
  readonly isDisabled?: boolean;
}

interface SelectorProps {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectorOption[];
  readonly onChange?: (value: string) => void;
  readonly isLabelHidden?: boolean;
  readonly isDisabled?: boolean;
  readonly width?: number | string;
  readonly size?: "sm" | "md" | "lg";
  readonly placement?: "above" | "below";
  readonly isLoading?: boolean;
  readonly labelTooltip?: string;
  readonly status?: InputStatus;
  readonly placeholder?: string;
  readonly className?: string;
  readonly name?: string;
  readonly required?: boolean;
  readonly hasAutoFocus?: boolean;
  readonly "aria-describedby"?: string;
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
  placement = "below",
  isLoading = false,
  labelTooltip,
  status,
  placeholder,
  className,
  name,
  required,
  hasAutoFocus = false,
  "aria-describedby": ariaDescribedBy,
}: SelectorProps): ReactNode {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const statusId = status?.message === undefined ? undefined : `${id}-status`;
  return (
    <Field
      aria-busy={isLoading || undefined}
      className="gap-1 text-xs"
      data-invalid={status?.type === "error" || undefined}
      style={{ width }}
    >
      <FieldLabel
        className={cn("font-medium", isLabelHidden && "sr-only")}
        htmlFor={id}
        title={labelTooltip}
      >
        {label}
      </FieldLabel>
      <Select
        disabled={isDisabled || isLoading}
        name={name}
        onValueChange={(nextValue) => onChange?.(nextValue ?? "")}
        required={required}
        value={value}
      >
        <SelectTrigger
          aria-describedby={[ariaDescribedBy, statusId].filter(Boolean).join(" ") || undefined}
          aria-invalid={status?.type === "error" || undefined}
          className={cn("w-full text-xs", size === "lg" && "h-9", className)}
          autoFocus={hasAutoFocus}
          id={id}
          size={size === "sm" ? "sm" : "default"}
        >
          <SelectValue placeholder={placeholder}>
            {(selectedValue) =>
              selectedValue === null || selectedValue === ""
                ? placeholder
                : (selectedLabel ?? String(selectedValue))
            }
          </SelectValue>
          {isLoading ? <SpinnerIcon aria-hidden className="size-3.5" /> : null}
        </SelectTrigger>
        <SelectContent side={placement === "above" ? "top" : "bottom"}>
          {options.map((option) => (
            <SelectItem disabled={option.isDisabled} key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {status?.message ? <FieldError id={statusId}>{status.message}</FieldError> : null}
    </Field>
  );
}

export function FieldStatus({
  message,
  type,
}: {
  readonly message: string;
  readonly type: InputStatus["type"];
}): ReactNode {
  return type === "error" ? (
    <FieldError className="m-0 text-xs">{message}</FieldError>
  ) : (
    <FieldDescription className="m-0 text-xs">{message}</FieldDescription>
  );
}
