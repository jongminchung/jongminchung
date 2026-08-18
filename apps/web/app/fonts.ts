import localFont from "next/font/local";

/** `pretendard` 앱 전체에서 사용하는 자체 호스팅 가변 폰트임 */
export const pretendard = localFont({
    src: "./fonts/PretendardVariable.woff2",
    display: "swap",
    weight: "45 920",
    variable: "--font-pretendard",
});
