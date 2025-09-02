import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { MysqlDialectConfig } from "kysely";
import type { MysqlIntrospectorOptions } from "./mysql/introspector.ts";
import type { PrinterOptions } from "./printer.ts";

export const CONFIG_FILENAME = "kysqlgen.config.ts";

export interface Config {
	dialect: "mysql2";
	dialectConfig: MysqlDialectConfig;
	introspectorOptions?: MysqlIntrospectorOptions;
	outFile?: string;
	printerOptions?: PrinterOptions;
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
		const filename = path.join(dir, CONFIG_FILENAME);
		if (existsSync(filename)) {
			return filename;
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
