import {
	type ColumnMetadata,
	type DatabaseIntrospector,
	type DatabaseMetadataOptions,
	DEFAULT_MIGRATION_LOCK_TABLE,
	DEFAULT_MIGRATION_TABLE,
	type Kysely,
	type SchemaMetadata,
	sql,
	type TableMetadata,
} from "kysely";
import type { InformationSchema } from "./information-schema.ts";
import type { DataType } from "./mysql-data-types.ts";

export type MysqlTableMetadata = Omit<TableMetadata, "columns"> & {
	readonly columns: MysqlColumnMetadata[];
	readonly comment?: string;
};

export type MysqlColumnMetadata = Omit<ColumnMetadata, "dataType"> & {
	readonly dataType: DataType;

	/**
	 * The full information schema "COLUMN_TYPE", which includes the type name and
	 * possibly other information such as the precision or length.
	 */
	readonly columnType: string;

	/**
	 * True if this is a virtual column.
	 */
	readonly isVirtual: boolean;

	/**
	 * Allowed member values for "enum" or "set" data types.
	 */
	readonly memberValues?: string[];
};

export interface MysqlDatabaseMetadata {
	readonly tables: MysqlTableMetadata[];
}

export class MysqlIntrospector implements DatabaseIntrospector {
	readonly #db: Kysely<InformationSchema>;

	constructor(
		// biome-ignore lint/suspicious/noExplicitAny: schema isn't needed here
		db: Kysely<any>,
	) {
		this.#db = db;
	}

	async getSchemas(): Promise<SchemaMetadata[]> {
		const rows = await this.#db
			.selectFrom("INFORMATION_SCHEMA.SCHEMATA")
			.select("SCHEMA_NAME")
			.execute();

		return rows.map((row) => ({
			name: row.SCHEMA_NAME,
		}));
	}

	async getTables(
		options?: DatabaseMetadataOptions,
	): Promise<MysqlTableMetadata[]> {
		let query = this.#db
			.selectFrom("INFORMATION_SCHEMA.COLUMNS as COLUMNS")
			.innerJoin("INFORMATION_SCHEMA.TABLES as TABLES", (b) =>
				b
					.onRef("COLUMNS.TABLE_SCHEMA", "=", "TABLES.TABLE_SCHEMA")
					.onRef("COLUMNS.TABLE_NAME", "=", "TABLES.TABLE_NAME"),
			)
			.select(["TABLES.TABLE_TYPE", "TABLES.TABLE_COMMENT"])
			.selectAll("COLUMNS")
			.where("COLUMNS.TABLE_SCHEMA", "=", sql<string>`database()`)
			.orderBy("COLUMNS.TABLE_NAME")
			.orderBy("COLUMNS.ORDINAL_POSITION");

		if (!options?.withInternalKyselyTables) {
			query = query
				.where("COLUMNS.TABLE_NAME", "!=", DEFAULT_MIGRATION_TABLE)
				.where("COLUMNS.TABLE_NAME", "!=", DEFAULT_MIGRATION_LOCK_TABLE);
		}

		const rows = await query.execute();

		const tables = new Map<string, MysqlTableMetadata>();
		for (const row of rows) {
			let table = tables.get(row.TABLE_NAME);
			if (!table) {
				table = {
					name: row.TABLE_NAME,
					schema: row.TABLE_SCHEMA,
					isView: row.TABLE_TYPE !== "BASE TABLE",
					comment: row.TABLE_COMMENT !== "" ? row.TABLE_COMMENT : undefined,
					columns: [],
				};
				tables.set(table.name, table);
			}

			const dataType = row.DATA_TYPE;
			const extra = row.EXTRA.toLowerCase();

			let memberValues: string[] | undefined;
			if (dataType === "enum" || dataType === "set") {
				memberValues = await this.#getMemberValues(row.COLUMN_TYPE);
			}

			table.columns.push({
				name: row.COLUMN_NAME,
				comment: row.COLUMN_COMMENT !== "" ? row.COLUMN_COMMENT : undefined,
				dataType,
				isAutoIncrementing: extra.includes("auto_increment"),
				isNullable: row.IS_NULLABLE === "YES",
				hasDefaultValue: row.COLUMN_DEFAULT !== null,
				columnType: row.COLUMN_TYPE,
				isVirtual: extra.includes("virtual"),
				memberValues,
			});
		}

		return Array.from(tables.values());
	}

	async getMetadata(
		options?: DatabaseMetadataOptions,
	): Promise<MysqlDatabaseMetadata> {
		const tables = await this.getTables(options);

		return {
			tables,
		};
	}

	async #getMemberValues(columnType: string): Promise<string[]> {
		// Extract the list of values from inside the parens
		const list = columnType.substring(
			columnType.indexOf("(") + 1,
			columnType.length - 1,
		);

		// Use SQL to re-select the value list, since this ensures MySQL
		// will split and unescape the strings for us correctly.
		const result = await sql`SELECT ${sql.raw(list)}`
			.$castTo<Record<string, string>>()
			.execute(this.#db);

		return Object.values(result.rows[0] ?? {});
	}
}
