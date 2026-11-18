import type {
  ColumnDef as CoreColumnDef,
  TableOptions,
  InitialTableState,
} from '@tanstack/table-core';
import type { Color } from '../badge';
import type { IconName } from '../icons';

import type { Html } from 'foldkit/html';

/** Shared presentation for row menus and the selection command palette. */
export interface Action {
  readonly value: string;
  readonly label: string;
  readonly icon?: Html;
  readonly shortcut?: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

export type TextOp =
  | 'is'
  | 'is not'
  | 'contains'
  | 'does not contain'
  | 'starts with'
  | 'ends with'
  | 'is empty'
  | 'is not empty';
export type SearchValue = string | { readonly column: string; readonly query: string };
export type FilterValue =
  | string
  | { readonly kind: 'text'; readonly query: string; readonly op?: TextOp }
  | { readonly kind: 'options'; readonly values: readonly string[]; readonly op?: 'is' | 'is not' }
  | { readonly kind: 'number'; readonly min?: number; readonly max?: number }
  | {
      readonly kind: 'date';
      readonly op?: 'between' | 'before' | 'after';
      readonly from?: string;
      readonly to?: string;
    };
export type SelectOption =
  | string
  | { readonly value: string; readonly label?: string; readonly color?: Color };
export type FilterKind =
  | 'text'
  | 'number'
  | 'date'
  | { readonly type: 'options'; readonly options: readonly SelectOption[] };
export type Editor =
  | 'text'
  | 'number'
  | 'date'
  | 'tags'
  | {
      readonly type: 'text';
      readonly placeholder?: string;
      readonly link?: boolean;
    }
  | { readonly type: 'number'; readonly options?: readonly number[]; readonly placeholder?: string }
  | { readonly type: 'date'; readonly placeholder?: string }
  | {
      readonly type: 'tags';
      readonly options?: readonly string[];
      readonly creatable?: boolean;
      readonly placeholder?: string;
    }
  | { readonly type: 'select'; readonly options: readonly SelectOption[] };
export type ColumnLines = 1 | 2 | 'wrap';
export interface ColumnMeta {
  readonly label?: string;
  readonly className?: string;
  readonly lines?: ColumnLines;
  readonly icon?: IconName;
  readonly filter?: FilterKind | false;
  readonly editor?: Editor;
}
/** TanStack definitions. Pass custom cell rendering as the top-level renderCell view input. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ColumnDef<T> = DistributiveOmit<
  CoreColumnDef<T, unknown>,
  'header' | 'cell' | 'footer' | 'meta'
> & {
  readonly header?: string;
  readonly meta?: ColumnMeta;
};
export interface Options<T> {
  readonly data: readonly T[];
  readonly columns: readonly ColumnDef<T>[];
  readonly getRowId?: TableOptions<T>['getRowId'];
  /** Override data-column values for sorting, filtering and display. Return the
   * row's own value for unchanged columns. A top-level callback keeps derived
   * accessors compatible with Foldkit view-input scoping; display columns stay inert. */
  readonly getCellValue?: (row: T, columnId: string) => unknown;
  readonly getSubRows?: TableOptions<T>['getSubRows'];
  readonly enableRowSelection?: TableOptions<T>['enableRowSelection'];
  readonly enableColumnPinning?: boolean;
  readonly pageSize?: number;
  readonly initialState?: InitialTableState;
  readonly filtersHidden?: boolean;
}
export interface RowMove {
  readonly rowIds: readonly string[];
  readonly targetId: string;
  readonly place: 'before' | 'after';
}
export interface Props<T> extends Options<T> {
  readonly label: string;
  readonly renderCell?: (row: T, columnId: string) => Html | string;
  readonly linkHref?: (row: T, columnId: string, value: string) => string;
  readonly title?: string;
  readonly titleAs?: 'h1' | 'h2' | 'h3';
  /** Compose public toolbar parts in a consumer-owned order inside the table scope. */
  readonly renderToolbar?: () => Html | null;
  /** Parent-owned saved-view controls, between the title/toolbar and filter chips.
   * Keep their Model and Messages in the parent; this slot supplies only placement. */
  readonly renderViews?: () => Html | null;
  /** Parent-owned actions after Add filter. The row remains hidden when no
   * filters are set or the reader has tucked it away. */
  readonly renderFilterActions?: () => Html | null;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly rowHover?: boolean;
  readonly resizeColumns?: boolean;
  readonly reorderColumns?: boolean;
  readonly cellAlign?: 'auto' | 'center' | 'top';
  readonly loading?: boolean;
  readonly loadingRows?: number;
  readonly fill?: boolean;
  readonly editable?: boolean;
  readonly rowClickable?: boolean;
  readonly reorderRows?: boolean;
  readonly empty?: {
    readonly title?: string;
    readonly description?: string;
    readonly action?: Html;
  };
  readonly search?: boolean;
  readonly searchCollapsible?: boolean;
  readonly searchColumn?: string;
  readonly searchPlaceholder?: string;
  readonly filters?: boolean;
  readonly viewOptions?: boolean;
  readonly pagination?: boolean;
  readonly pageSizes?: readonly number[];
  readonly selectionBar?: boolean;
  /** Row menu actions; appearance and disabled state use the shared Menu contract. */
  readonly rowActions?: readonly Action[];
  /** Selection palette actions; the parent handles SelectionAction OutMessages. */
  readonly selectionActions?: readonly Action[];
  readonly className?: string;
}
