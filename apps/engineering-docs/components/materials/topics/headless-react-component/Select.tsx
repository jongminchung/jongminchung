// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useControllableState } from "./useControllableState";

/**
 * 본문 '컴포넌트로 만드는 Headless 컴포넌트' 절에서 구현하는 Select의 완성본.
 * SkinSwapDemo가 이 컴포넌트를 그대로 가져다 세 가지 스킨을 입힌다.
 */

type Handler<E> = (event: E) => void;

function composeHandlers<E>(theirs?: Handler<E>, ours?: Handler<E>): Handler<E> {
  return (event) => {
    theirs?.(event);
    ours?.(event);
  };
}

interface OptionItem {
  id: string;
  value: string;
  label: string;
}

interface SelectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openListbox: () => void;
  value: string | null;
  select: (value: string) => void;
  options: OptionItem[];
  registerOption: (option: OptionItem) => () => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  moveActive: (to: "next" | "prev" | "first" | "last") => void;
  listboxId: string;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(part: string) {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error(`<Select.${part}>는 <Select.Root> 안에서만 사용할 수 있다`);
  }
  return context;
}

export interface SelectRootProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Root = ({
  value: controlledValue,
  defaultValue = null,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: SelectRootProps) => {
  const [value, setValue] = useControllableState<string | null>({
    value: controlledValue,
    defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const registerOption = useCallback((option: OptionItem) => {
    setOptions((prev) => [...prev, option]);
    return () => setOptions((prev) => prev.filter((o) => o.id !== option.id));
  }, []);

  // 열 때는 선택된 옵션(없으면 첫 옵션)부터 하이라이트한다
  const openListbox = useCallback(() => {
    const selectedIndex = options.findIndex((o) => o.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [options, value, setOpen]);

  const select = useCallback(
    (next: string) => {
      setValue(next);
      setOpen(false);
    },
    [setValue, setOpen],
  );

  const moveActive = useCallback(
    (to: "next" | "prev" | "first" | "last") => {
      if (options.length === 0) return;
      setActiveIndex((prev) => {
        switch (to) {
          case "first":
            return 0;
          case "last":
            return options.length - 1;
          case "next":
            return Math.min(prev + 1, options.length - 1);
          case "prev":
            return Math.max(prev - 1, 0);
        }
      });
    },
    [options.length],
  );

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpen]);

  const context = useMemo(
    () => ({
      open,
      setOpen,
      openListbox,
      value,
      select,
      options,
      registerOption,
      activeIndex,
      setActiveIndex,
      moveActive,
      listboxId,
    }),
    [
      open,
      setOpen,
      openListbox,
      value,
      select,
      options,
      registerOption,
      activeIndex,
      moveActive,
      listboxId,
    ],
  );

  return (
    <SelectContext.Provider value={context}>
      <div ref={rootRef} data-state={open ? "open" : "closed"} {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Trigger = ({ children, ...props }: SelectTriggerProps) => {
  const { open, setOpen, openListbox, options, activeIndex, select, moveActive, listboxId } =
    useSelectContext("Trigger");

  const handleClick = () => {
    if (open) {
      setOpen(false);
    } else {
      openListbox();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openListbox();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive("next");
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive("prev");
        break;
      case "Home":
        event.preventDefault();
        moveActive("first");
        break;
      case "End":
        event.preventDefault();
        moveActive("last");
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const active = options[activeIndex];
        if (active) select(active.value);
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const activeOption = open && activeIndex >= 0 ? options[activeIndex] : undefined;

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={activeOption?.id}
      data-state={open ? "open" : "closed"}
      {...props}
      onClick={composeHandlers(props.onClick, handleClick)}
      onKeyDown={composeHandlers(props.onKeyDown, handleKeyDown)}
    >
      {children}
    </button>
  );
};

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const Value = ({ placeholder = "선택", ...props }: SelectValueProps) => {
  const { value, options } = useSelectContext("Value");
  const selected = options.find((o) => o.value === value);
  return (
    <span data-placeholder={selected ? undefined : ""} {...props}>
      {selected ? selected.label : placeholder}
    </span>
  );
};

export interface SelectListboxProps extends React.HTMLAttributes<HTMLUListElement> {}

const Listbox = ({ children, ...props }: SelectListboxProps) => {
  const { open, listboxId } = useSelectContext("Listbox");
  return (
    <ul
      role="listbox"
      id={listboxId}
      hidden={!open}
      data-state={open ? "open" : "closed"}
      {...props}
    >
      {children}
    </ul>
  );
};

export interface SelectOptionProps extends React.LiHTMLAttributes<HTMLLIElement> {
  value: string;
}

const Option = ({ value, children, ...props }: SelectOptionProps) => {
  const {
    registerOption,
    select,
    value: selectedValue,
    options,
    activeIndex,
    setActiveIndex,
  } = useSelectContext("Option");
  const id = useId();
  const ref = useRef<HTMLLIElement>(null);
  const label = typeof children === "string" ? children : value;

  // 마운트될 때 자신을 등록하고, 사라질 때 등록을 해제한다
  useEffect(() => {
    return registerOption({ id, value, label });
  }, [registerOption, id, value, label]);

  const index = options.findIndex((o) => o.id === id);
  const isActive = index >= 0 && index === activeIndex;
  const isSelected = selectedValue === value;

  // 키보드로 하이라이트가 옮겨오면 스크롤을 따라가게 한다
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isActive]);

  return (
    <li
      ref={ref}
      id={id}
      role="option"
      aria-selected={isSelected}
      data-state={isSelected ? "checked" : "unchecked"}
      data-highlighted={isActive ? "" : undefined}
      {...props}
      onClick={composeHandlers(props.onClick, () => select(value))}
      onPointerMove={composeHandlers(props.onPointerMove, () => {
        if (!isActive && index >= 0) setActiveIndex(index);
      })}
    >
      {children}
    </li>
  );
};

Root.displayName = "Select.Root";
Trigger.displayName = "Select.Trigger";
Value.displayName = "Select.Value";
Listbox.displayName = "Select.Listbox";
Option.displayName = "Select.Option";

export const Select = { Root, Trigger, Value, Listbox, Option };
