import { useEffect, useRef, useState } from "react";

// 데모가 화면에 보일 때만 애니메이션 루프를 돌리기 위한 훅.
// 이 글이 말하는 "화면 밖의 일은 미룬다"를 데모 스스로 실천한다.
export function useVisible<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(([entry]) => {
            if (entry !== undefined) setVisible(entry.isIntersecting);
        });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return { ref, visible };
}
