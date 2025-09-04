import assert from "node:assert";
import test, { after, before } from "node:test";
import { type Generated, Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { Type } from "../type.ts";
import type { ColumnMetadata } from "../type-collector.ts";
import { MysqlTypeCollector } from "./mysql-collector.ts";
import { MysqlIntrospector } from "./mysql-introspector.ts";

const tableName = "introspect_tests" as const;

interface TestTable {
	id: Generated<number>;
	varchar_str: string;
	json_str: unknown;
	enum_list: "foo" | "bar";
	big_num: bigint;
	uint: number;
	bool_flag: boolean;
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
		.addColumn("big_num", "bigint", (col) => col.notNull())
		.addColumn("uint", "integer", (col) => col.unsigned().notNull())
		.addColumn("bool_flag", "boolean", (col) => col.notNull())
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

	const pool = createPool({
		uri,
		bigNumberStrings: true,
		supportBigNumbers: true,
		typeCast: (field, next) => {
			if (field.type === "TINY" && field.length === 1) {
				return field.string() === "1"; // 1 = true, 0 = false
			} else if (field.type === "LONGLONG") {
				const s = field.string();
				return s === null ? null : BigInt(s);
			} else {
				return next();
			}
		},
	});

	const config = {
		pool,
	};

	const db = new Kysely<TestDB>({ dialect: new MysqlDialect(config) });

	before(async () => migrate(db));
	after(async () => db.destroy());

	const introspector = new MysqlIntrospector(db);
	const collector = new MysqlTypeCollector(introspector, pool.config, {
		typeCasts: {
			"tinyint(1)": Type.boolean,
			bigint: Type.bigint,
		},
		jsonColumns: {
			[`${tableName}.json_str`]: Type.array(Type.number),
		},
	});

	await t.test("getTables", async () => {
		const tables = await collector.collectTables();

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
				big_num: 100n,
				uint: 123,
				bool_flag: true,
			})
			.executeTakeFirstOrThrow();

		const row = await db
			.selectFrom(tableName)
			.selectAll()
			.where("id", "=", Number(insertId))
			.executeTakeFirstOrThrow();

		const expectedColumns: Array<{
			name: keyof TestTable;
			runtimeType: string;
			tsType: Type;
		}> = [
			{
				name: "id",
				runtimeType: "bigint",
				tsType: Type.Generated(Type.bigint),
			},
			{
				name: "varchar_str",
				runtimeType: "string",
				tsType: Type.string,
			},
			{
				name: "json_str",
				runtimeType: "array",
				tsType: Type.JSONColumnType(Type.array(Type.number)),
			},
			{
				name: "enum_list",
				runtimeType: "string",
				tsType: Type.union(
					Type.stringLiteral("foo"),
					Type.stringLiteral("bar"),
				),
			},
			{
				name: "big_num",
				runtimeType: "bigint",
				tsType: Type.bigint,
			},
			{
				name: "uint",
				runtimeType: "number",
				tsType: Type.number,
			},
			{
				name: "bool_flag",
				runtimeType: "boolean",
				tsType: Type.boolean,
			},
		];

		for (const { name, runtimeType, tsType } of expectedColumns) {
			const col = columns.get(name);
			assert(col);
			assert.deepStrictEqual(col.columnType, tsType);
			const msg = `Expected type ${runtimeType} for column ${col.name}, got ${typeof row[name]}`;
			if (runtimeType === "array") {
				assert(Array.isArray(row[name]), msg);
			} else {
				assert.equal(typeof row[name], runtimeType, msg);
			}
		}
	});
});
