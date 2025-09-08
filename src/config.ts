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
import pkg from "./../package.json" with { type: "json" };
import type { Dialect } from "./dialect.ts";
import type {
	MysqlConfig as MysqlTypeConfig,
	PoolConfig,
} from "./mysql/mysql-config.ts";
import { MysqlDialect as MysqlTypeDialect } from "./mysql/mysql-dialect.ts";
import type { PrinterOptions } from "./printer.ts";
import {
	loadDatabaseConfig,
	type SqliteConfig as SqliteTypeConfig,
} from "./sqlite/sqlite-config.ts";
import { SqliteDialect as SqliteTypeDialect } from "./sqlite/sqlite-dialect.ts";

export const CONFIG_FILENAME = `${pkg.name}.config.ts`;

type BaseConfig = {
	outFile?: string;
	printerOptions?: PrinterOptions;
};

type MysqlConfig = {
	dialect: "mysql2";
	dialectConfig: MysqlDialectConfig;
	typeConfig?: MysqlTypeConfig;
};

type SqliteConfig = {
	dialect: "better-sqlite3";
	dialectConfig: SqliteDialectConfig;
	typeConfig?: SqliteTypeConfig;
};

type DialectConfig = MysqlConfig | SqliteConfig;
export type Config = BaseConfig & DialectConfig;

export type ResolvedConfig = BaseConfig & {
	// biome-ignore lint/suspicious/noExplicitAny: no schema
	db: Kysely<any>;
	dialect: Dialect;
};

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

export async function resolveConfig(config: Config): Promise<ResolvedConfig> {
	const { dialect, outFile, printerOptions } = config;

	const baseConfig: BaseConfig = {
		outFile,
		printerOptions,
	};

	switch (dialect) {
		case "mysql2": {
			// Resolve the pool so we can access the pool config
			const pool =
				typeof config.dialectConfig.pool === "function"
					? await config.dialectConfig.pool()
					: config.dialectConfig.pool;
			const dialect = new MysqlTypeDialect({
				...config.typeConfig,
				// The pool is really the "mysql2" pool type so this is safe
				poolConfig: (pool as unknown as { config: PoolConfig }).config,
			});
			// biome-ignore lint/suspicious/noExplicitAny: no schema
			const db = new Kysely<any>({
				dialect: new MysqlDialect({
					...config.dialectConfig,
					pool,
				}),
			});
			return {
				dialect,
				db,
				...baseConfig,
			};
		}
		case "better-sqlite3": {
			// biome-ignore lint/suspicious/noExplicitAny: no schema
			const db = new Kysely<any>({
				dialect: new SqliteDialect(config.dialectConfig),
			});
			const databaseConfig = await loadDatabaseConfig(db);
			const dialect = new SqliteTypeDialect({
				...config.typeConfig,
				databaseConfig,
			});
			return {
				dialect,
				db,
				...baseConfig,
			};
		}
		default:
			throw new Error(
				`Unknown dialect ${(config as { dialect: string }).dialect}`,
			);
	}
}
