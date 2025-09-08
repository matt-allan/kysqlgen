import type { Type } from "../type.ts";
import type { ColumnDataType } from "./mysql-data-types.ts";

export interface MysqlConfig {
	/**
	 * Type casts for specific column types.
	 *
	 * This should be used to re-map types when you are using the "typeCast"
	 * option of mysql2.
	 */
	typeCasts?: {
		[K in ColumnDataType]?: Type;
	};

	/**
	 * A map of table qualified column names to types to use for JSON columns.
	 * The type will be used instead of `unknown` as the select type.
	 */
	jsonColumns?: Record<`${string}.${string}`, Type>;

	/**
	 * Configuration from the underlying mysql2 pool.
	 *
	 * You can access this as `pool.config` on the pool instance.
	 */
	poolConfig?: PoolConfig;
}

/**
 * This is equivalent to the `PoolOptions` type from mysql2.
 */
export type PoolConfig = {
	bigNumberStrings?: boolean;
	decimalNumbers?: boolean;
	supportBigNumbers?: boolean;
	jsonStrings?: boolean;
	dateStrings?: boolean | Array<"TIMESTAMP" | "DATETIME" | "DATE">;
};
