import type { ColumnMetadata, DatabaseIntrospector } from "kysely";
import { Type } from "../type.ts";
import type { TableMetadata, TypeCollector } from "../type-collector.ts";
import type { DatabaseConfig, SqliteConfig } from "./sqlite-config.ts";

export class SqliteCollector implements TypeCollector {
	#introspector: DatabaseIntrospector;
	#config: SqliteConfig;

	constructor(introspector: DatabaseIntrospector, config: SqliteConfig = {}) {
		this.#introspector = introspector;
		this.#config = config;
	}

	async collectTables(): Promise<TableMetadata[]> {
		const tables = await this.#introspector.getTables();

		// TODO: use our own introspector, then we can use `typeof` to get the real
		// type and we can use xinfo to get virtual columns too.

		return tables.map((table) => ({
			...table,
			columns: table.columns.map((column) => ({
				name: column.name,
				dataType: column.dataType,
				columnType: this.#getColumnType(table.name, column),
			})),
		}));
	}

	#getColumnType(table: string, col: ColumnMetadata): Type {
		const dataType = columnAffinity(col.dataType);

		const value = DATA_TYPE_MAP[dataType];
		let type =
			typeof value === "function"
				? value(this.#config.databaseConfig ?? {})
				: value;

		const castType = this.#config?.columnCasts?.[`${table}.${col.name}`];
		if (castType) {
			type = castType;
		}

		if (col.isNullable) {
			type = Type.nullable(type);
		}

		if (col.isAutoIncrementing || col.hasDefaultValue) {
			type = Type.generated(type);
		}

		return type;
	}
}

export type DataType = "INTEGER" | "TEXT" | "BLOB" | "REAL" | "NUMERIC";

/**
 * @see https://sqlite.org/datatype3.html#determination_of_column_affinity
 */
function columnAffinity(dataType: string): DataType {
	const declaredType = dataType.toUpperCase().trim();

	if (declaredType.includes("INT")) {
		return "INTEGER";
	}

	if (
		declaredType.includes("CHAR") ||
		declaredType.includes("CLOB") ||
		declaredType.includes("TEXT")
	) {
		return "TEXT";
	}

	if (declaredType.includes("BLOB") || declaredType === "") {
		return "BLOB";
	}

	if (
		declaredType.includes("REAL") ||
		declaredType.includes("FLOA") ||
		declaredType.includes("DOUB")
	) {
		return "REAL";
	}

	return "NUMERIC";
}

type TypeFn = (config: DatabaseConfig) => Type;

/**
 * @see https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
 * @see https://github.com/WiseLibs/better-sqlite3/blob/master/docs/integer.md
 */
const DATA_TYPE_MAP: Record<DataType, Type | TypeFn> = {
	INTEGER: ({ defaultSafeIntegers }) =>
		defaultSafeIntegers ? Type.bigint : Type.number,
	TEXT: Type.string,
	BLOB: Type.buffer,
	REAL: Type.number,
	NUMERIC: Type.number,
};
