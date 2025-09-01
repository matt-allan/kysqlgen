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
import { getNativeType, isDataType } from "./data-types.ts";
import type { InformationSchema } from "./information-schema.ts";

export async function createMysqlIntrospector(config: MysqlDialectConfig) {
	const pool = await (typeof config.pool === "function"
		? config.pool()
		: Promise.resolve(config.pool));

	const db = new Kysely({
		dialect: new MysqlDialect({
			...config,
			pool,
		}),
	});

	const introspector = new MysqlIntrospector(db, pool as Pool);

	return {
		db,
		pool,
		introspector,
	};
}

export class MysqlIntrospector implements DatabaseIntrospector {
	readonly #db: Kysely<InformationSchema>;
	readonly #pool: Pool;

	// biome-ignore lint/suspicious/noExplicitAny: not needed here
	constructor(db: Kysely<any>, pool: Pool) {
		this.#db = db;
		this.#pool = pool;
	}

	async getTables(): Promise<TableMetadata[]> {
		const rows = await this.#db
			.selectFrom("INFORMATION_SCHEMA.COLUMNS as COLUMNS")
			.innerJoin("INFORMATION_SCHEMA.TABLES as TABLES", (b) =>
				b
					.onRef("COLUMNS.TABLE_SCHEMA", "=", "TABLES.TABLE_SCHEMA")
					.onRef("COLUMNS.TABLE_NAME", "=", "TABLES.TABLE_NAME"),
			)
			.select([
				"TABLES.TABLE_SCHEMA",
				"TABLES.TABLE_NAME",
				"TABLES.TABLE_TYPE",
				"TABLES.TABLE_COMMENT",
				"COLUMNS.COLUMN_NAME",
				"COLUMNS.COLUMN_TYPE",
				"COLUMNS.DATA_TYPE",
				"COLUMNS.IS_NULLABLE",
				"COLUMNS.COLUMN_DEFAULT",
				"COLUMNS.EXTRA",
				"COLUMNS.COLUMN_COMMENT",
			])
			.where("COLUMNS.TABLE_SCHEMA", "=", sql<string>`database()`)
			.where("COLUMNS.TABLE_NAME", "!=", DEFAULT_MIGRATION_TABLE)
			.where("COLUMNS.TABLE_NAME", "!=", DEFAULT_MIGRATION_LOCK_TABLE)
			.orderBy("COLUMNS.TABLE_NAME")
			.orderBy("COLUMNS.ORDINAL_POSITION")
			.execute();

		const tables = new Map<string, TableMetadata>();
		const poolOpts = this.#poolOptions();

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

			const dataType = row.DATA_TYPE;

			if (!isDataType(dataType)) {
				throw new Error(
					`Unknown MySQL data type ${dataType} for column ${table}.${row.COLUMN_NAME}`,
				);
			}

			let tsType: Required<TsType> = {
				type: getNativeType(dataType, poolOpts),
				imports: [],
			};

			// Extract enum or set definitions
			if (dataType === "enum" || dataType === "set") {
				// Extract the list of values from inside the parens
				const valuesSql = row.COLUMN_TYPE.substring(
					dataType.length + 1,
					row.COLUMN_TYPE.length - 1,
				);

				// Use SQL to re-select the value list, since this ensures MySQL
				// will split and unescape the strings for us correctly.
				const result = await sql`SELECT ${sql.raw(valuesSql)}`
					.$castTo<Record<string, string>>()
					.execute(this.#db);

				const values = Object.values(result.rows[0] ?? {});

				tsType.type = values.map((v) => `"${v}"`).join(" | ");
			}

			// Add the import for Buffer
			if (tsType.type === "Buffer") {
				tsType = {
					type: "Buffer",
					imports: [
						{
							moduleSpecifier: "node:buffer",
							namedBindings: ["Buffer"],
						},
					],
				};
			}

			// Apply any refinements from the column meta
			if (row.IS_NULLABLE === "YES") {
				tsType.type = `${tsType.type} | null`;
			}
			if (
				row.COLUMN_DEFAULT !== null ||
				row.EXTRA.toLowerCase().includes("auto_increment")
			) {
				tsType.type = `Generated<${tsType.type}>`;
				tsType.imports.push({
					moduleSpecifier: "kysely",
					namedBindings: ["Generated"],
				});
			}

			table.columns.push({
				name: row.COLUMN_NAME,
				comment: row.COLUMN_COMMENT,
				tsType,
			});
		}

		return Array.from(tables.values());
	}

	#poolOptions(): PoolOptions {
		return this.#pool.config;
	}
}
