import type { PoolOptions } from "mysql2";
import {
	Generated,
	GeneratedAlways,
	isColumnType,
	JSONColumnType,
	Type,
} from "../type.ts";
import type { TableMetadata, TypeCollector } from "../type-collector.ts";
import { type ColumnDataType, getNativeType } from "./mysql-data-types.ts";
import type {
	MysqlColumnMetadata,
	MysqlIntrospector,
} from "./mysql-introspector.ts";

export interface MysqlTypeOptions {
	typeCasts?: {
		[K in ColumnDataType]?: Type;
	};
	/**
	 * A map of table qualified column names to types to use for JSON columns.
	 * The type will be used instead of `unknown` as the select type.
	 */
	jsonColumns?: Record<`${string}.${string}`, Type>;
}

export class MysqlTypeCollector implements TypeCollector {
	#introspector: MysqlIntrospector;
	#poolConfig: PoolOptions;
	#options: MysqlTypeOptions;

	constructor(
		introspector: MysqlIntrospector,
		poolConfig: PoolOptions,
		options: MysqlTypeOptions = {},
	) {
		this.#introspector = introspector;
		this.#poolConfig = poolConfig;
		this.#options = options;
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
			return new GeneratedAlways(type);
		}

		if (col.isAutoIncrementing) {
			return new Generated(type);
		}

		if (col.dataType === "json") {
			return new JSONColumnType(
				type,
				// If the column has a default value, we need to explicitly use
				// `string | undefined` for the insert type. Otherwise we can use
				// the default, which is `string`.
				col.hasDefaultValue ? Type.optional(Type.string) : undefined,
			);
		}

		if (col.hasDefaultValue) {
			return new Generated(type);
		}

		return type;
	}

	#getSelectType(table: string, col: MysqlColumnMetadata): Type {
		const dataType = col.dataType;
		const columnType = parseColumnType(col.columnType);

		// Check for an explicit data type cast
		const cast =
			this.#options?.typeCasts?.[columnType] ??
			this.#options?.typeCasts?.[dataType];
		if (cast) {
			return cast;
		}

		// Check for a more precise JSON type
		if (dataType === "json") {
			const jsonType = this.#options?.jsonColumns?.[`${table}.${col.name}`];
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
		return getNativeType(dataType, this.#poolConfig);
	}
}

function parseColumnType(columnType: string): ColumnDataType {
	const i = columnType.indexOf(" ");

	return (i ? columnType.substring(i - 1) : columnType) as ColumnDataType;
}
