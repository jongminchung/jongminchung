import React, { useCallback } from "react";
import { useControllableState } from "./useControllableState";

/**
 * 본문 '훅으로 만드는 Headless 컴포넌트' 절에서 구현하는 훅의 완성본.
 * SwitchSkinDemo가 이 훅을 그대로 가져다 세 가지 스킨을 입힌다.
 */

type Handler<E> = (event: E) => void;

function composeHandlers<E>(
    theirs?: Handler<E>,
    ours?: Handler<E>,
): Handler<E> {
    return (event) => {
        theirs?.(event);
        ours?.(event);
    };
}

export interface UseSwitchOptions {
    checked?: boolean;
    defaultChecked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export function useSwitch({
    checked: controlledChecked,
    defaultChecked = false,
    disabled = false,
    onCheckedChange,
}: UseSwitchOptions = {}) {
    const [checked, setChecked] = useControllableState({
        value: controlledChecked,
        defaultValue: defaultChecked,
        onChange: onCheckedChange,
    });

    const toggle = useCallback(() => {
        if (disabled) return;
        setChecked(!checked);
    }, [checked, disabled, setChecked]);

    const getSwitchProps = (
        userProps: React.HTMLAttributes<HTMLElement> = {},
    ) => ({
        role: "switch" as const,
        "aria-checked": checked,
        "aria-disabled": disabled || undefined,
        tabIndex: disabled ? -1 : 0,
        "data-state": checked ? "checked" : "unchecked",
        "data-disabled": disabled ? "" : undefined,
        ...userProps,
        onClick: composeHandlers(userProps.onClick, toggle),
        onKeyDown: composeHandlers<React.KeyboardEvent<HTMLElement>>(
            userProps.onKeyDown,
            (event) => {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    toggle();
                }
            },
        ),
    });

    return { checked, toggle, getSwitchProps };
}
