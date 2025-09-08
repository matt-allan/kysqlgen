import { isColumnType, Type } from "../type.ts";
import type { TableMetadata, TypeCollector } from "../type-collector.ts";
import type { MysqlConfig } from "./mysql-config.ts";
import { type ColumnDataType, getNativeType } from "./mysql-data-types.ts";
import type {
	MysqlColumnMetadata,
	MysqlIntrospector,
} from "./mysql-introspector.ts";

export class MysqlTypeCollector implements TypeCollector {
	#introspector: MysqlIntrospector;
	#config: MysqlConfig;

	constructor(introspector: MysqlIntrospector, config: MysqlConfig = {}) {
		this.#introspector = introspector;
		this.#config = config;
	}

	async collectTables(): Promise<TableMetadata[]> {
		const tables = await this.#introspector.getTables();

		return tables.map((table) => ({
			...table,
			columns: table.columns.map((col) => ({
				name: col.name,
				columnType: this.#getType(table.name, col),
				comment: col.comment,
			})),
		}));
	}

	#getType(table: string, col: MysqlColumnMetadata): Type {
		let type = this.#getSelectType(table, col);

		// Apply any refinements from the column meta
		if (col.isNullable) {
			type = Type.nullable(type);
		}

		// If it's already a column type (i.e. from a cast), don't wrap it again.
		if (isColumnType(type)) {
			return type;
		}

		if (col.isVirtual) {
			return Type.generatedAlways(type);
		}

		if (col.isAutoIncrementing) {
			return Type.generated(type);
		}

		if (col.dataType === "json") {
			return Type.jsonColumnType(
				type,
				// If the column has a default value, we need to explicitly use
				// `string | undefined` for the insert type. Otherwise we can use
				// the default, which is `string`.
				col.hasDefaultValue ? Type.optional(Type.string) : undefined,
			);
		}

		if (col.hasDefaultValue) {
			return Type.generated(type);
		}

		return type;
	}

	#getSelectType(table: string, col: MysqlColumnMetadata): Type {
		const dataType = col.dataType;
		const columnType = parseColumnType(col.columnType);

		// Check for an explicit data type cast
		const cast =
			this.#config?.typeCasts?.[columnType] ??
			this.#config?.typeCasts?.[dataType];
		if (cast) {
			return cast;
		}

		// Check for a more precise JSON type
		if (dataType === "json") {
			const jsonType = this.#config?.jsonColumns?.[`${table}.${col.name}`];
			if (jsonType) {
				return jsonType;
			}
		}

		// Extract enum or set definitions
		if (
			(dataType === "enum" || dataType === "set") &&
			col.memberValues?.length
		) {
			return Type.union(...col.memberValues.map(Type.stringLiteral));
		}

		// Fallback to the default mapping for the driver
		return getNativeType(dataType, this.#config.poolConfig);
	}
}

function parseColumnType(columnType: string): ColumnDataType {
	const i = columnType.indexOf(" ");

	return (i ? columnType.substring(i - 1) : columnType) as ColumnDataType;
}
