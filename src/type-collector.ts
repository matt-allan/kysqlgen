import type { Type } from "./type.ts";

export interface TableMetadata {
	readonly name: string;
	readonly columns: ColumnMetadata[];
	readonly schema?: string;
	readonly comment?: string;
}

export interface ColumnMetadata {
	readonly name: string;
	readonly columnType: Type;
	readonly comment?: string;
}

/**
 * Collects database type information.
 */
export interface TypeCollector {
	collectTables(): Promise<TableMetadata[]>;
}
