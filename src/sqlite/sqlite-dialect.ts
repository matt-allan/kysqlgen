import type { Kysely } from "kysely";
import type { Dialect } from "../dialect.ts";
import type { TypeCollector } from "../type-collector.ts";
import { SqliteCollector } from "./sqlite-collector.ts";
import type { SqliteConfig } from "./sqlite-config.ts";

export class SqliteDialect implements Dialect {
	#config: SqliteConfig;

	constructor(config: SqliteConfig) {
		this.#config = config;
	}

	// biome-ignore lint/suspicious/noExplicitAny: no schema
	createTypeCollector(db: Kysely<any>): TypeCollector {
		return new SqliteCollector(db.introspection, this.#config);
	}
}
