"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

/** 추가 로딩으로 변경된 현재 페이지를 보기 전환 링크에도 반영함. */
export function EditorialViewLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { readonly href: string }) {
  const searchParams = useSearchParams();
  const destination = new URL(href, "https://local.invalid");
  const page = searchParams.get("page");
  if (page === null) destination.searchParams.delete("page");
  else destination.searchParams.set("page", page);
  return (
    <Link {...props} href={`${destination.pathname}${destination.search}`} />
  );
}
