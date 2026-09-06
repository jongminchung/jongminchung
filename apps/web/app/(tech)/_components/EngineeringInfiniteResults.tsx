"use client";

import {
  EditorialInfiniteResults,
  type EditorialInfiniteResultsProps,
} from "#components/EditorialInfiniteResults";
import { EngineeringCard } from "./EngineeringCard";

/** 추가 로딩도 최초 서버 렌더링과 같은 Tech 카드로 조합함. */
export function EngineeringInfiniteResults(
  props: EditorialInfiniteResultsProps,
): React.JSX.Element {
  return (
    <EditorialInfiniteResults
      {...props}
      renderItem={(item) => <EngineeringCard item={item} />}
    />
  );
}
