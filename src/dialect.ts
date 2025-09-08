import type { Kysely } from "kysely";
import type { TypeCollector } from "./type-collector.ts";

export interface Dialect {
	// biome-ignore lint/suspicious/noExplicitAny: no schema here
	createTypeCollector(db: Kysely<any>): TypeCollector;
}
