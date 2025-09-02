import {
	DEFAULT_MIGRATION_LOCK_TABLE,
	DEFAULT_MIGRATION_TABLE,
	Kysely,
	MysqlDialect,
	type MysqlDialectConfig,
	sql,
} from "kysely";
import type { Pool, PoolOptions } from "mysql2";
import type {
	DatabaseIntrospector,
	TableMetadata,
	TsType,
} from "../introspector.ts";
import { type DataType, getNativeType } from "./data-types.ts";
import type {
	ColumnMetadata,
	InformationSchema,
} from "./information-schema.ts";

export async function createMysqlIntrospector(
	config: MysqlDialectConfig,
	options: MysqlIntrospectorOptions = {},
) {
	const pool = await (typeof config.pool === "function"
		? config.pool()
		: Promise.resolve(config.pool));

	const db = new Kysely({
		dialect: new MysqlDialect({
			...config,
			pool,
		}),
	});

	const introspector = new MysqlIntrospector(db, pool as Pool, options);

	return {
		db,
		pool,
		introspector,
	};
}

export interface MysqlIntrospectorOptions {
	/** A map of column or data type to native type to cast to */
	casts?: Record<DataType | string, string>;
	/** A map of table.column names to the JSON types to use. */
	jsonTypes?: Record<string, string>;
}

export class MysqlIntrospector implements DatabaseIntrospector {
	readonly #db: Kysely<InformationSchema>;
	readonly #pool: Pool;
	readonly #options: MysqlIntrospectorOptions;

	constructor(
		// biome-ignore lint/suspicious/noExplicitAny: not needed here
		db: Kysely<any>,
		pool: Pool,
		options: MysqlIntrospectorOptions = {},
	) {
		this.#db = db;
		this.#pool = pool;
		this.#options = options;
	}

	async getTables(): Promise<TableMetadata[]> {
		const rows = await this.#db
			.selectFrom("INFORMATION_SCHEMA.COLUMNS as COLUMNS")
			.innerJoin("INFORMATION_SCHEMA.TABLES as TABLES", (b) =>
				b
					.onRef("COLUMNS.TABLE_SCHEMA", "=", "TABLES.TABLE_SCHEMA")
					.onRef("COLUMNS.TABLE_NAME", "=", "TABLES.TABLE_NAME"),
			)
			.select(["TABLES.TABLE_TYPE", "TABLES.TABLE_COMMENT"])
			.selectAll("COLUMNS")
			.where("COLUMNS.TABLE_SCHEMA", "=", sql<string>`database()`)
			.where("COLUMNS.TABLE_NAME", "!=", DEFAULT_MIGRATION_TABLE)
			.where("COLUMNS.TABLE_NAME", "!=", DEFAULT_MIGRATION_LOCK_TABLE)
			.orderBy("COLUMNS.TABLE_NAME")
			.orderBy("COLUMNS.ORDINAL_POSITION")
			.execute();

		const tables = new Map<string, TableMetadata>();

		for (const row of rows) {
			let table = tables.get(row.TABLE_NAME);
			if (!table) {
				table = {
					name: row.TABLE_NAME,
					schema: row.TABLE_SCHEMA,
					comment: row.TABLE_COMMENT,
					columns: [],
				};
				tables.set(table.name, table);
			}

			const tsType = await this.#getTsType(row);

			table.columns.push({
				name: row.COLUMN_NAME,
				comment: row.COLUMN_COMMENT,
				tsType,
			});
		}

		return Array.from(tables.values());
	}

	async #getTsType(col: ColumnMetadata): Promise<TsType> {
		const dataType = col.DATA_TYPE;

		let nativeType = getNativeType(col.DATA_TYPE, this.#poolOptions);

		const casts = this.#options.casts ?? {};
		const columnTypeCast = casts[col.COLUMN_TYPE];
		const dataTypeCast = casts[col.DATA_TYPE];

		// Prefer the more specific column type cast
		if (columnTypeCast) {
			nativeType = columnTypeCast;
		} else if (dataTypeCast) {
			nativeType = dataTypeCast;
		}

		const tsType: TsType = {
			type: nativeType,
		};

		// // Add the import for Buffer
		if (nativeType === "Buffer") {
			tsType.imports = [
				{
					moduleSpecifier: "node:buffer",
					namedBindings: ["Buffer"],
				},
			];
		}

		// Extract enum or set definitions
		if (dataType === "enum" || dataType === "set") {
			// Extract the list of values from inside the parens
			const valuesSql = col.COLUMN_TYPE.substring(
				dataType.length + 1,
				col.COLUMN_TYPE.length - 1,
			);

			// Use SQL to re-select the value list, since this ensures MySQL
			// will split and unescape the strings for us correctly.
			const result = await sql`SELECT ${sql.raw(valuesSql)}`
				.$castTo<Record<string, string>>()
				.execute(this.#db);

			const values = Object.values(result.rows[0] ?? {});

			tsType.type = values.map((v) => `"${v}"`).join(" | ");
		}

		// Apply any refinements from the column meta
		if (col.IS_NULLABLE === "YES") {
			tsType.type = `${tsType.type} | null`;
		}

		let jsonType: string | undefined;
		if (dataType === "json") {
			jsonType =
				this.#options?.jsonTypes?.[`${col.TABLE_NAME}.${col.COLUMN_NAME}`];
		}

		// Wrap the base type with a column type
		if (jsonType) {
			tsType.type = `JSONColumnType<${jsonType}>`;
			tsType.imports ??= [];
			tsType.imports.push({
				moduleSpecifier: "kysely",
				namedBindings: ["JSONColumnType"],
			});
		} else if (
			col.COLUMN_DEFAULT !== null ||
			col.EXTRA.toLowerCase().includes("auto_increment")
		) {
			tsType.type = `Generated<${tsType.type}>`;
			tsType.imports ??= [];
			tsType.imports.push({
				moduleSpecifier: "kysely",
				namedBindings: ["Generated"],
			});
		}

		return tsType;
	}

	get #poolOptions(): PoolOptions {
		return this.#pool.config;
	}
}
