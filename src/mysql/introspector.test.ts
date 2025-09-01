import assert from "node:assert";
import test from "node:test";
import { type Generated, Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import type { ColumnMetadata, TsType } from "../introspector.ts";
import { MysqlIntrospector } from "./introspector.ts";

const tableName = "introspect_tests" as const;

interface TestTable {
	id: Generated<number>;
	varchar_str: string;
	json_str: unknown;
	enum_list: "foo" | "bar";
}

interface TestDB {
	[tableName]: TestTable;
}

// biome-ignore lint/suspicious/noExplicitAny: schema won't exist while migrating
async function migrate(db: Kysely<any>) {
	await db.schema.dropTable(tableName).ifExists().execute();

	await db.schema
		.createTable(tableName)
		.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
		.addColumn("varchar_str", "varchar(200)", (col) => col.notNull())
		.addColumn("json_str", "json", (col) => col.notNull())
		.addColumn("enum_list", sql`enum('foo', 'bar')`, (col) => col.notNull())
		.modifyEnd(
			sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		)
		.execute();
}

test("MysqlIntrospector", async (t) => {
	const uri = process.env.MYSQL_URI;
	if (!uri) {
		t.skip("Missing MYSQL_URI");
		return;
	}

	const pool = createPool({ uri });

	const config = {
		pool,
	};

	const db = new Kysely<TestDB>({ dialect: new MysqlDialect(config) });

	await migrate(db);

	const introspector = new MysqlIntrospector(db, pool);

	await t.test("getTables", async () => {
		const tables = await introspector.getTables();

		const testTable = tables.find((tbl) => tbl.name === tableName);

		assert(testTable);

		const columns: Map<keyof TestTable, ColumnMetadata> = new Map(
			testTable.columns.map((col) => [col.name as keyof TestTable, col]),
		);

		const { insertId } = await db
			.insertInto(tableName)
			.values({
				varchar_str: "hello world",
				json_str: "[1,2,3]",
				enum_list: "foo",
			})
			.executeTakeFirstOrThrow();

		const row = await db
			.selectFrom(tableName)
			.selectAll()
			.where("id", "=", Number(insertId))
			.executeTakeFirstOrThrow();

		const expectedColumns: Array<{
			name: keyof TestTable;
			type: string | ((v: unknown) => boolean);
			tsType: TsType;
		}> = [
			{
				name: "id",
				type: "number",
				tsType: {
					type: "Generated<number>",
					imports: [
						{ moduleSpecifier: "kysely", namedBindings: ["Generated"] },
					],
				},
			},
			{
				name: "varchar_str",
				type: "string",
				tsType: { type: "string" },
			},
			{
				name: "json_str",
				type: (v) => Array.isArray(v),
				tsType: { type: "unknown" },
			},
			{
				name: "enum_list",
				type: "string",
				tsType: { type: `"foo" | "bar"` },
			},
		];

		for (const { name, type, tsType } of expectedColumns) {
			const col = columns.get(name);
			assert(col);
			assert.deepStrictEqual(col.tsType, {
				...tsType,
				imports: tsType.imports ?? [],
			});
			if (typeof type === "string") {
				assert.equal(
					typeof row[name],
					type,
					`Unexpected column type for ${col.name}`,
				);
			} else {
				assert(type(row[name]), `Unexpected column type for ${col.name}`);
			}
		}
	});

	await db.destroy();
});
