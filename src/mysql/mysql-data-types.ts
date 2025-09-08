import { Type } from "../type.ts";
import type { PoolConfig } from "./mysql-config.ts";

type IntDataType = "tinyint" | "smallint" | "int" | "mediumint" | "bigint";

/**
 * Supported (known) MySQL data types.
 *
 * @see https://dev.mysql.com/doc/refman/9.4/en/data-types.html
 */
export type DataType =
	// Numeric
	| IntDataType
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
	| "geomcollection"
	// JSON
	| "json";

/**
 * The full data type for a column with paramaters.
 *
 * This is the "COLUMN_TYPE" from the information schema with any
 * attributes (e.g. "CHARSET ...", "UNSIGNED") stripped.
 */
export type ColumnDataType =
	| DataType
	// Numeric
	| `${IntDataType | "decimal" | "float" | "double" | "bit"}(${number})`
	| `decimal(${number}, ${number})`
	// Date and time
	| `year(${number})`
	// String
	| `${"char" | "varchar" | "binary" | "varbinary" | "blob" | "text"}(${number})`;

type TypeFn = (dateType: string, opts: PoolConfig) => Type;

const dateStrings: TypeFn = (dataType, { dateStrings }) => {
	const asString = Array.isArray(dateStrings)
		? dateStrings.map((t) => t.toLowerCase()).includes(dataType)
		: !!dateStrings;

	return asString ? Type.string : Type.Date;
};

const jsonStrings: TypeFn = (_, { jsonStrings }) =>
	jsonStrings ? Type.string : Type.unknown;

const bigNumbers: TypeFn = (_, { supportBigNumbers, bigNumberStrings }) => {
	if (!supportBigNumbers) {
		return Type.number;
	}
	return bigNumberStrings ? Type.string : Type.union(Type.number, Type.string);
};

const decimalNumbers: TypeFn = (dataType, opts) => {
	if (opts.decimalNumbers) {
		return Type.number;
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
const DATA_TYPE_MAP: Record<DataType, Type | TypeFn> = {
	// Numeric
	tinyint: Type.number,
	smallint: Type.number,
	int: Type.number,
	mediumint: Type.number,
	bigint: bigNumbers,
	decimal: decimalNumbers,
	float: Type.number,
	double: Type.number,
	bit: Type.buffer,
	// Date and time
	date: dateStrings,
	time: Type.string,
	datetime: dateStrings,
	timestamp: dateStrings,
	year: Type.number,
	// String
	char: Type.string,
	varchar: Type.string,
	binary: Type.buffer,
	varbinary: Type.buffer,
	tinyblob: Type.buffer,
	blob: Type.buffer,
	mediumblob: Type.buffer,
	longblob: Type.buffer,
	tinytext: Type.string,
	text: Type.string,
	mediumtext: Type.string,
	longtext: Type.string,
	enum: Type.string,
	set: Type.string,
	vector: Type.string,
	// Spatial
	geometry: Type.string,
	point: Type.string,
	linestring: Type.string,
	polygon: Type.string,
	multipoint: Type.string,
	multilinestring: Type.string,
	multipolygon: Type.string,
	geomcollection: Type.string,
	// Misc
	json: jsonStrings,
} as const;

export function isDataType(type: string): type is DataType {
	return DATA_TYPE_MAP[type as DataType] !== undefined;
}

/**
 * Get the native JavaScript type for the given MySQL data type and pool options.
 */
export function getNativeType(dataType: DataType, opts: PoolConfig = {}): Type {
	const nativeType = DATA_TYPE_MAP[dataType];

	if (!nativeType) {
		throw new Error(`Unknown MySQL data type ${dataType}`);
	}

	return typeof nativeType === "function"
		? nativeType(dataType, opts)
		: nativeType;
}
