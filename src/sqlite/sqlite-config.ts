import type { Kysely } from "kysely";
import type { Type } from "../type.ts";

export interface SqliteConfig {
	/**
	 * A map of table qualified column names to types to use.
	 *
	 * This can be used for more specific types that are still compatible with
	 * the base type, e.g. using a string literal union for an enum like TEXT
	 * column. The types are not checked for compatibility.
	 */
	columnCasts?: Record<`${string}.${string}`, Type>;

	/**
	 * Configuration from the underlying sqlite3 database.
	 */
	databaseConfig?: DatabaseConfig;
}

export interface DatabaseConfig {
	/**
	 * Set this to true if `defaultSafeIntegers` is enabled on the underlying
	 * database. This setting returns `INTEGER` columns as bigint instead of number.
	 */
	defaultSafeIntegers?: boolean;
}

export async function loadDatabaseConfig(
	// biome-ignore lint/suspicious/noExplicitAny: no schema needed here
	db: Kysely<any>,
): Promise<DatabaseConfig> {
	// There is no way to read the state of the "defaultSafeIntegers" option
	// so execute a simple query and check the runtime type.
	const { n } = await db
		.selectNoFrom((eb) => eb.lit(1).as("n"))
		.executeTakeFirstOrThrow();
	const defaultSafeIntegers = typeof (n as bigint | number) === "bigint";

	return {
		defaultSafeIntegers,
	};
}
