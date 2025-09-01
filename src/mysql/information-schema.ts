/**
 * A Database type defining the information schema tables needed for
 * code generation.
 *
 * @see https://dev.mysql.com/doc/refman/9.1/en/information-schema.html
 */
export interface InformationSchema {
	"INFORMATION_SCHEMA.SCHEMATA": SchemataTable;
	"INFORMATION_SCHEMA.TABLES": TablesTable;
	"INFORMATION_SCHEMA.COLUMNS": ColumnsTable;
}

/**
 * Defines the `INFORMATION_SCHEMA.SCHEMATA` table.
 *
 * This is not exhaustive; only columns relevant to introspection are defined.
 *
 * @see https://dev.mysql.com/doc/refman/8.4/en/information-schema-schemata-table.html
 */
export interface SchemataTable {
	SCHEMA_NAME: string;
}

/**
 * Defines the `INFORMATION_SCHEMA.TABLES` table.
 *
 * This is not exhaustive; only columns relevant to introspection are defined.
 *
 * @see https://dev.mysql.com/doc/refman/9.1/en/information-schema-tables-table.html
 */
export interface TablesTable {
	TABLE_SCHEMA: string;
	TABLE_NAME: string;
	TABLE_TYPE: "BASE TABLE" | "VIEW" | "SYSTEM VIEW";
	TABLE_COMMENT: string;
}

/**
 * Defines the `INFORMATION_SCHEMA.COLUMNS` table.
 *
 * This is not exhaustive; only columns relevant to introspection are defined.
 *
 * @see https://dev.mysql.com/doc/refman/9.1/en/information-schema-columns-table.html
 */
export interface ColumnsTable {
	TABLE_SCHEMA: string;
	TABLE_NAME: string;
	COLUMN_NAME: string;
	ORDINAL_POSITION: number;
	COLUMN_DEFAULT: string | null;
	IS_NULLABLE: "YES" | "NO";
	DATA_TYPE: string;
	CHARACTER_MAXIMUM_LENGTH: bigint | null;
	CHARACTER_OCTET_LENGTH: bigint | null;
	NUMERIC_PRECISION: bigint | null;
	NUMERIC_SCALE: bigint | null;
	DATETIME_PRECISION: number | null;
	CHARACTER_SET_NAME: string | null;
	COLLATION_NAME: string | null;
	COLUMN_TYPE: string;
	COLUMN_KEY: "" | "PRI" | "UNI" | "MUL";
	EXTRA: string;
	PRIVILEGES: string;
	COLUMN_COMMENT: string;
	GENERATION_EXPRESSION: string;
}
