import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	Kysely,
	MysqlDialect,
	type MysqlDialectConfig,
	SqliteDialect,
	type SqliteDialectConfig,
} from "kysely";
import type { Pool } from "mysql2";
import pkg from "./../package.json" with { type: "json" };
import {
	MysqlTypeCollector,
	type MysqlTypeOptions,
} from "./mysql/mysql-collector.ts";
import { MysqlIntrospector } from "./mysql/mysql-introspector.ts";
import type { PrinterOptions } from "./printer.ts";
import { SqliteCollector } from "./sqlite/sqlite-collector.ts";
import type { TypeCollector } from "./type-collector.ts";

export const CONFIG_FILENAME = `${pkg.name}.config.ts`;

type BaseConfig = {
	outFile?: string;
	printerOptions?: PrinterOptions;
};

type MysqlConfig = {
	dialect: "mysql2";
	dialectConfig: MysqlDialectConfig;
	typeOptions?: MysqlTypeOptions;
};

type SqliteConfig = {
	dialect: "better-sqlite3";
	dialectConfig: SqliteDialectConfig;
};

type DialectConfig = MysqlConfig | SqliteConfig;

export type Config = BaseConfig & DialectConfig;

export type ResolvedConfig = BaseConfig & {
  // biome-ignore lint/suspicious/noExplicitAny: required here
  db: Kysely<any>;
  typeCollector: TypeCollector
}

export function defineConfig(input: Config): Config {
	return input;
}

export async function loadConfig(filename: string): Promise<Config> {
	const mod = await import(pathToFileURL(filename).href);

	const config = mod.default;

	validateConfig(config);

	return config;
}

export function locateConfig(cwd?: string): string | null {
	let dir = cwd ?? process.cwd();
	let lastDir: string | undefined;

	while (dir !== lastDir) {
		for (const filename of [
			path.join(dir, CONFIG_FILENAME),
			path.join(dir, ".config", CONFIG_FILENAME),
		]) {
			if (existsSync(filename)) {
				return filename;
			}
		}

		lastDir = dir;
		dir = path.resolve(dir, "..");
	}

	return null;
}

function validateConfig(value: unknown): asserts value is Config {
	if (typeof value !== "object" || value === null) {
		throw new Error(`Unexpected Config type ${typeof value}`);
	}

	if (!Object.hasOwn(value, "dialect")) {
		throw new Error("Missing config dialect");
	}
}

export async function resolveConfig(
	config: Config,
): Promise<ResolvedConfig> {
	const { dialect, dialectConfig } = config;

	switch (dialect) {
		case "mysql2": {
			const pool = await (typeof dialectConfig.pool === "function"
				? dialectConfig.pool()
				: Promise.resolve(dialectConfig.pool));

			const db = new Kysely({
				dialect: new MysqlDialect({
					...dialectConfig,
					pool,
				}),
			}).withoutPlugins();

			const typeCollector = new MysqlTypeCollector(
				new MysqlIntrospector(db),
				(pool as Pool).config,
				config.typeOptions,
			);
			return { db, typeCollector };
		}
		case "better-sqlite3": {
			const db = new Kysely({
				dialect: new SqliteDialect(dialectConfig),
			}).withoutPlugins();

			return {
				db,
				typeCollector: new SqliteCollector(db.introspection),
			};
		}

		default:
			throw new Error(
				`Unknown dialect ${(config as { dialect: string }).dialect}`,
			);
	}
}
