import type { TypeImport } from "./imports.ts";

/**
 * Returns metadata about the database, including the TypeScript types for
 * each column.
 *
 * This interface is not compatible with Kysely's DatabaseIntrospector.
 */
export interface DatabaseIntrospector {
	/**
	 * Get tables and views metadata.
	 */
	getTables(): Promise<TableMetadata[]>;
}

export interface TableMetadata {
	readonly name: string;
	readonly schema?: string;
	readonly columns: ColumnMetadata[];
	readonly comment?: string;
}

/**
 * A type definition for a Typescript type.
 *
 * This can be a simple string type name like "number" or a complex type
 * definition with generics etc. The definition is opaque to the compiler.
 *
 * For complex types you should specify any necessary imports, which will be
 * de-duplicated by the compiler.
 */
export interface TsType {
	type: string;
	imports?: TypeImport[];
}

export interface ColumnMetadata {
	readonly name: string;
	readonly comment?: string;
	readonly tsType: TsType;
}
