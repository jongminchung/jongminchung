"use client";

import {
    type FC,
    type Key,
    type KeyboardEvent,
    useEffect,
    useState,
} from "react";

// 타입 정의
export interface ColumnDefinition {
    id: string;
    label: string;
    type: "TEXT" | "NUMBER" | "DATE";
    align: "LEFT" | "CENTER" | "RIGHT";
    sortable: boolean;
}

export interface TableCell<T> {
    columnId: string;
    value: T | null;
}

export interface TableRow<T> {
    id?: Key;
    cells: TableCell<T>[];
}

export interface Pagination {
    page: number;
    totalPage: number;
    pageSize: number;
}

export interface SortInfo {
    columnId: string;
    direction: "ASC" | "DESC";
}

export interface FilterInfo {
    columnId: string;
    type:
        | "EQUAL"
        | "NOT_EQUAL"
        | "IN"
        | "BETWEEN"
        | "LIKE"
        | "NOT_LIKE"
        | "GREATER_THAN"
        | "LESS_THAN";
    value: unknown;
}

export interface TableState {
    filters?: FilterInfo[] | null;
    sorting?: SortInfo[] | null;
}

export interface TableViewModel<T> {
    columns: ColumnDefinition[];
    rows: TableRow<T>[];
    sortable: boolean;
    pagination?: Pagination | null;
    state: TableState;
}

export interface TableRequestParams {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: "ASC" | "DESC";
    filters?: Record<string, unknown>;
}

export interface TableRendererProps<T> {
    viewModel: TableViewModel<T>;
    onSortChange?: (sortInfo: SortInfo) => void;
    onPageChange?: (page: number) => void;
    onRowClick?: (row: TableRow<T>) => void;
    loading?: boolean;
    className?: string;
}

// 유틸리티 함수
export const formatCellValue = (
    value: unknown,
    type: ColumnDefinition["type"],
): string => {
    if (value === null || value === undefined) return "";

    switch (type) {
        case "NUMBER":
            return Number(value).toLocaleString();
        case "DATE":
            if (value instanceof Date) {
                return value.toLocaleDateString();
            } else if (typeof value === "string") {
                return new Date(value).toLocaleDateString();
            }
            return serializeCellValue(value);
        default:
            return serializeCellValue(value);
    }
};

function serializeCellValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (
        typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "boolean"
    ) {
        return String(value);
    }
    try {
        return JSON.stringify(value) ?? "";
    } catch {
        return Object.prototype.toString.call(value);
    }
}

// 특정 컬럼의 셀 찾기
export const findCellByColumnId = <T,>(
    row: TableRow<T>,
    columnId: string,
): TableCell<T> | undefined => {
    return row.cells.find((cell) => cell.columnId === columnId);
};

// 정렬 아이콘 컴포넌트
interface SortIconProps {
    columnId: string;
    sortable: boolean;
    sorting?: SortInfo[] | null;
}

const SortIcon: FC<SortIconProps> = ({ columnId, sortable, sorting }) => {
    if (!sortable) return null;

    const currentSort = sorting?.[0];
    if (currentSort?.columnId === columnId) {
        return currentSort.direction === "ASC" ? (
            <span aria-hidden="true" className="sort-icon">
                ↑
            </span>
        ) : (
            <span aria-hidden="true" className="sort-icon">
                ↓
            </span>
        );
    }

    return (
        <span aria-hidden="true" className="sort-icon sort-icon-none">
            ↕
        </span>
    );
};

// 테이블 헤더 컴포넌트
interface TableHeaderProps {
    columns: ColumnDefinition[];
    sortable: boolean;
    sorting?: SortInfo[] | null;
    onSort: (columnId: string) => void;
}

const TableHeader = ({
    columns,
    sortable,
    sorting,
    onSort,
}: TableHeaderProps) => {
    return (
        <thead>
            <tr>
                {columns.map((column) => {
                    const isSortable = sortable && column.sortable;
                    const direction = sorting?.find(
                        (item) => item.columnId === column.id,
                    )?.direction;
                    return (
                        <th
                            key={column.id}
                            aria-sort={
                                isSortable
                                    ? direction === "ASC"
                                        ? "ascending"
                                        : direction === "DESC"
                                          ? "descending"
                                          : "none"
                                    : undefined
                            }
                            className={`column-${column.align.toLowerCase()} ${isSortable ? "sortable" : ""}`}
                        >
                            {isSortable ? (
                                <button
                                    aria-label={`${column.label} 정렬`}
                                    className="th-content"
                                    type="button"
                                    onClick={() => onSort(column.id)}
                                >
                                    <span>{column.label}</span>
                                    <SortIcon
                                        columnId={column.id}
                                        sortable
                                        sorting={sorting}
                                    />
                                </button>
                            ) : (
                                <div className="th-content">
                                    <span>{column.label}</span>
                                </div>
                            )}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
};

// 로딩 컴포넌트
interface LoadingRowProps {
    colSpan: number;
}

const LoadingRow: FC<LoadingRowProps> = ({ colSpan }) => (
    <tr>
        <td colSpan={colSpan} className="loading-cell">
            <div
                aria-label="데이터 불러오는 중"
                className="loading-spinner"
                role="status"
            />
        </td>
    </tr>
);

// 빈 데이터 표시 컴포넌트
interface EmptyRowProps {
    colSpan: number;
    message?: string;
}

const EmptyRow: FC<EmptyRowProps> = ({
    colSpan,
    message = "데이터가 없습니다.",
}) => (
    <tr>
        <td colSpan={colSpan} className="empty-table">
            {message}
        </td>
    </tr>
);

// 테이블 셀 컴포넌트
interface TableCellProps {
    columnId: string;
    columnType: ColumnDefinition["type"];
    align: ColumnDefinition["align"];
    value: unknown;
}

const TableCellComponent: FC<TableCellProps> = ({
    columnId,
    columnType,
    align,
    value,
}) => (
    <td key={columnId} className={`column-${align.toLowerCase()}`}>
        {formatCellValue(value, columnType)}
    </td>
);

// 테이블 행 컴포넌트
interface TableRowProps<T> {
    row: TableRow<T>;
    columns: ColumnDefinition[];
    onClick?: (row: TableRow<T>) => void;
}

const TableRowComponent = <T,>({ row, columns, onClick }: TableRowProps<T>) => {
    const activate = (): void => onClick?.(row);
    const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
        if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        activate();
    };

    return (
        <tr
            className={onClick ? "clickable-row" : ""}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick ? activate : undefined}
            onKeyDown={onClick ? handleKeyDown : undefined}
        >
            {columns.map((column) => {
                const cell = findCellByColumnId(row, column.id);
                const value = cell ? cell.value : null;

                return (
                    <TableCellComponent
                        key={column.id}
                        columnId={column.id}
                        columnType={column.type}
                        align={column.align}
                        value={value}
                    />
                );
            })}
        </tr>
    );
};

// 테이블 본문 컴포넌트
interface TableBodyProps<T> {
    columns: ColumnDefinition[];
    rows: TableRow<T>[];
    loading: boolean;
    onRowClick?: (row: TableRow<T>) => void;
}

const TableBody = <T,>({
    columns,
    rows,
    loading,
    onRowClick,
}: TableBodyProps<T>) => {
    if (loading) {
        return (
            <tbody>
                <LoadingRow colSpan={columns.length} />
            </tbody>
        );
    }

    if (rows.length === 0) {
        return (
            <tbody>
                <EmptyRow colSpan={columns.length} />
            </tbody>
        );
    }

    return (
        <tbody>
            {rows.map((row, index) => (
                <TableRowComponent
                    key={row.id ?? index}
                    row={row}
                    columns={columns}
                    onClick={onRowClick}
                />
            ))}
        </tbody>
    );
};

// 페이지네이션 컴포넌트
interface PaginationComponentProps {
    pagination: Pagination;
    onPageChange: (page: number) => void;
}

const PaginationComponent: FC<PaginationComponentProps> = ({
    pagination,
    onPageChange,
}) => {
    const { page, totalPage, pageSize } = pagination;

    return (
        <div className="table-pagination">
            <button
                aria-label="첫 페이지"
                className="pagination-button"
                disabled={page <= 1}
                type="button"
                onClick={() => onPageChange(1)}
            >
                {"<<"}
            </button>
            <button
                aria-label="이전 페이지"
                className="pagination-button"
                disabled={page <= 1}
                type="button"
                onClick={() => onPageChange(page - 1)}
            >
                {"<"}
            </button>

            <span className="pagination-info">
                {page} / {totalPage}
            </span>

            <button
                aria-label="다음 페이지"
                className="pagination-button"
                disabled={page >= totalPage}
                type="button"
                onClick={() => onPageChange(page + 1)}
            >
                {">"}
            </button>
            <button
                aria-label="마지막 페이지"
                className="pagination-button"
                disabled={page >= totalPage}
                type="button"
                onClick={() => onPageChange(totalPage)}
            >
                {">>"}
            </button>

            <span className="pagination-size-info">({pageSize}개씩 보기)</span>
        </div>
    );
};

// 메인 테이블 렌더러 컴포넌트
const TableRenderer = <T,>({
    viewModel,
    onSortChange,
    onPageChange,
    onRowClick,
    loading = false,
    className = "",
}: TableRendererProps<T>) => {
    // 내부 상태
    const [state, setState] = useState<TableState>(viewModel.state);

    // 뷰모델 변경 시 내부 상태 업데이트
    useEffect(() => {
        setState(viewModel.state);
    }, [viewModel.state]);

    // 정렬 처리
    const handleSort = (columnId: string) => {
        if (!viewModel.sortable) return;

        const column = viewModel.columns.find((col) => col.id === columnId);
        if (!column || !column.sortable) return;

        let newDirection: "ASC" | "DESC" = "ASC";
        const currentSort = state.sorting?.[0];
        if (currentSort?.columnId === columnId) {
            newDirection = currentSort.direction === "ASC" ? "DESC" : "ASC";
        }

        const newSortInfo: SortInfo = {
            columnId,
            direction: newDirection,
        };

        const newState = {
            ...state,
            sorting: [newSortInfo],
        };

        setState(newState);

        if (onSortChange) {
            onSortChange(newSortInfo);
        }
    };

    // 페이지 변경 처리
    const handlePageChange = (page: number) => {
        if (!viewModel.pagination) return;

        if (page >= 1 && page <= viewModel.pagination.totalPage) {
            if (onPageChange) {
                onPageChange(page);
            }
        }
    };

    return (
        <div className={`table-renderer-container ${className}`}>
            <div className="table-wrapper">
                <table className="vm-table">
                    <TableHeader
                        columns={viewModel.columns}
                        sortable={viewModel.sortable}
                        sorting={state.sorting}
                        onSort={handleSort}
                    />
                    <TableBody
                        columns={viewModel.columns}
                        rows={viewModel.rows}
                        loading={loading}
                        onRowClick={onRowClick}
                    />
                </table>
            </div>
            {viewModel.pagination && (
                <PaginationComponent
                    pagination={viewModel.pagination}
                    onPageChange={handlePageChange}
                />
            )}
        </div>
    );
};

export default TableRenderer;
