import type { ColumnMetadata, DatabaseIntrospector } from "kysely";
import { Type } from "../type.ts";
import type { TableMetadata, TypeCollector } from "../type-collector.ts";

export class SqliteCollector implements TypeCollector {
	#introspector: DatabaseIntrospector;

	constructor(introspector: DatabaseIntrospector) {
		this.#introspector = introspector;
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
				columnType: getColumnType(column),
			})),
		}));
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

const DATA_TYPE_MAP: Record<DataType, Type> = {
	INTEGER: Type.number,
	TEXT: Type.string,
	BLOB: Type.buffer,
	REAL: Type.number,
	NUMERIC: Type.number,
};

function getColumnType(col: ColumnMetadata): Type {
	const dataType = columnAffinity(col.dataType);

	let type = DATA_TYPE_MAP[dataType];

	if (col.isNullable) {
		type = Type.nullable(type);
	}

	if (col.isAutoIncrementing || col.hasDefaultValue) {
		type = Type.generated(type);
	}

	return type;
}
