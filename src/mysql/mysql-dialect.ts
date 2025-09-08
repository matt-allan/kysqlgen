import type { Kysely } from "kysely";
import type { Dialect } from "../dialect.ts";
import type { TypeCollector } from "../type-collector.ts";
import { MysqlTypeCollector } from "./mysql-collector.ts";
import type { MysqlConfig } from "./mysql-config.ts";
import { MysqlIntrospector } from "./mysql-introspector.ts";

export class MysqlDialect implements Dialect {
	#config: MysqlConfig;

	constructor(config: MysqlConfig) {
		this.#config = config;
	}

	// biome-ignore lint/suspicious/noExplicitAny: no schema
	createTypeCollector(db: Kysely<any>): TypeCollector {
		return new MysqlTypeCollector(new MysqlIntrospector(db), this.#config);
	}
}
