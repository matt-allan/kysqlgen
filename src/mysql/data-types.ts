import type { PoolOptions } from "mysql2";

/**
 * Supported (known) MySQL data types.
 *
 * @see https://dev.mysql.com/doc/refman/9.4/en/data-types.html
 */
export type DataType =
	// Numeric
	| "tinyint"
	| "smallint"
	| "int"
	| "mediumint"
	| "bigint"
	| "decimal"
	| "float"
	| "double"
	| "bit"
	// Date and time
	| "date"
	| "time"
	| "datetime"
	| "timestamp"
	| "year"
	// String
	| "char"
	| "varchar"
	| "binary"
	| "varbinary"
	| "tinyblob"
	| "blob"
	| "mediumblob"
	| "longblob"
	| "tinytext"
	| "text"
	| "mediumtext"
	| "longtext"
	| "enum"
	| "set"
	| "vector"
	// Spatial
	| "geometry"
	| "point"
	| "linestring"
	| "polygon"
	| "multipoint"
	| "multilinestring"
	| "multipolygon"
	| "geometrycollection"
	// JSON
	| "json";

/**
 * Native JS types supported by the mysql2 driver by default.
 *
 * This is only typed to minimize typos and aid autocomplete.
 */
type NativeType =
	| "number"
	| "string"
	| "number | string"
	| "Buffer"
	| "Date"
	| "unknown";

type TypeFn = (
	dateType: string,
	opts: PoolOptions,
) => NativeType | `${NativeType} | ${NativeType}`;

const dateStrings: TypeFn = (dataType, { dateStrings }) => {
	const asString = Array.isArray(dateStrings)
		? dateStrings.map((t) => t.toLowerCase()).includes(dataType)
		: !!dateStrings;

	return asString ? "string" : "Date";
};

const jsonStrings: TypeFn = (_, { jsonStrings }) =>
	jsonStrings ? "string" : "unknown";

const bigNumbers: TypeFn = (_, { supportBigNumbers, bigNumberStrings }) => {
	if (!supportBigNumbers) {
		return "number";
	}
	return bigNumberStrings ? "string" : "number | string";
};

const decimalNumbers: TypeFn = (dataType, opts) => {
	if (opts.decimalNumbers) {
		return "number";
	}

	return bigNumbers(dataType, opts);
};

/**
 * Base mapping from SQL data type name to base TypeScript type name.
 *
 * @see https://dev.mysql.com/doc/refman/9.4/en/data-types.html
 * @see https://github.com/mysqljs/mysql?tab=readme-ov-file#type-casting
 * @see https://sidorares.github.io/node-mysql2/docs/api-and-configurations
 */
const TYPE_MAP: Record<DataType, NativeType | TypeFn> = {
	// Numeric
	tinyint: "number",
	smallint: "number",
	int: "number",
	mediumint: "number",
	bigint: bigNumbers,
	decimal: decimalNumbers,
	float: "number",
	double: "number",
	bit: "Buffer",
	// Date and time
	date: dateStrings,
	time: "string",
	datetime: dateStrings,
	timestamp: dateStrings,
	year: "number",
	// String
	char: "string",
	varchar: "string",
	binary: "Buffer",
	varbinary: "Buffer",
	tinyblob: "Buffer",
	blob: "Buffer",
	mediumblob: "Buffer",
	longblob: "Buffer",
	tinytext: "string",
	text: "string",
	mediumtext: "string",
	longtext: "string",
	enum: "string",
	set: "string",
	vector: "string",
	// Spatial
	geometry: "string",
	point: "string",
	linestring: "string",
	polygon: "string",
	multipoint: "string",
	multilinestring: "string",
	multipolygon: "string",
	geometrycollection: "string",
	// Misc
	json: jsonStrings,
} as const;

export function isDataType(type: string): type is DataType {
	return TYPE_MAP[type as DataType] !== undefined;
}

export function getNativeType(dataType: DataType, opts: PoolOptions): string {
	const nativeType = TYPE_MAP[dataType];

	if (!nativeType) {
		throw new Error(`Unknown MySQL data type ${dataType}`);
	}

	return typeof nativeType === "function"
		? nativeType(dataType, opts)
		: nativeType;
}
