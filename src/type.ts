import type { TypeImport } from "./imports.ts";

/**
 * A type definition for a Typescript type.
 */
export interface Type {
	type: string;
	imports?: TypeImport[];
}

export function createType(type: string, imports?: TypeImport[]): Type {
	return {
		type,
		imports,
	};
}

abstract class LiteralType implements Type {
	readonly value: string | number;

	constructor(value: string | number) {
		this.value = value;
	}

	get type() {
		const v = this.value;
		return typeof v === "string" ? `"${v}"` : v.toString();
	}

	get imports() {
		return undefined;
	}
}

export class StringLiteral extends LiteralType {
	// biome-ignore lint/complexity/noUselessConstructor: used to narrow the type
	constructor(value: string) {
		super(value);
	}
}

export class NumericLiteral extends LiteralType {
	// biome-ignore lint/complexity/noUselessConstructor: used to narrow the type
	constructor(value: number) {
		super(value);
	}
}

abstract class CompoundType implements Type {
	readonly op: "|" | "&";
	readonly types: Type[];

	constructor(op: "|" | "&", ...types: Type[]) {
		this.op = op;
		this.types = types.flatMap((t) =>
			t instanceof CompoundType && t.op === op ? t.types : t,
		);
	}

	get type() {
		return this.types.map((t) => t.type).join(` ${this.op} `);
	}

	get imports() {
		return this.types.flatMap((t) => t.imports ?? []);
	}
}

export class UnionType extends CompoundType {
	constructor(...types: Type[]) {
		super("|", ...types);
	}
}

export class IntersectionType extends CompoundType {
	constructor(...types: Type[]) {
		super("&", ...types);
	}
}

const alphanumericRegex = /^[a-zA-Z0-9]+$/;

export class ArrayType implements Type {
	readonly elementType: Type;

	constructor(elementType: Type) {
		this.elementType = elementType;
	}

	get type() {
		const elType = this.elementType.type;

		// Only use the short array syntax for alphanumeric types, since it
		// won't work correctly for compound types or conditional types and
		// can be hard to read with generics and type literals.
		if (alphanumericRegex.test(elType)) {
			return `${elType}[]`;
		}

		return `Array<${elType}>`;
	}

	get imports() {
		return this.elementType.imports;
	}
}

/**
 * Get the list of defined type params, with defaults applied as needed.
 * The trailing undefined parameters are removed completely. Any remaining
 * undefined parameters in the middle of the list are replaced with defaults.
 * This ensures that the parameters always appear in the correct position.
 */
export function normalizeTypeParams<T extends Array<Type | undefined>>(
	params: T,
	defaults: { [K in keyof T]: Type } | Type,
): Type[] {
	const defaultsArray = Array.isArray(defaults)
		? defaults
		: new Array(params.length).fill(defaults);

	const end = params.indexOf(undefined);

	return (end !== -1 ? params.slice(0, end) : params).map(
		(t, i): Type => (t !== undefined ? t : (defaultsArray[i] as Type)),
	);
}

/**
 * Represents a Kysely ColumnType utility type.
 */
export class ColumnType implements Type {
	readonly selectType: Type;
	readonly insertType?: Type;
	readonly updateType?: Type;

	constructor(selectType: Type, insertType?: Type, updateType?: Type) {
		this.selectType = selectType;
		this.insertType = insertType;
		this.updateType = updateType;
	}

	get typeParameters(): Type[] {
		return normalizeTypeParams(
			[this.selectType, this.insertType, this.updateType],
			this.selectType,
		);
	}

	get type(): string {
		return `ColumnType<${this.typeParameters.map((t) => t.type).join(", ")}>`;
	}

	get imports(): TypeImport[] | undefined {
		return [
			...this.typeParameters.flatMap((t) => t?.imports ?? []),
			{
				moduleSpecifier: "kysely",
				namedBindings: ["ColumnType"],
			},
		];
	}
}

/**
 * Represents a Kysely JSONColumnType utility type.
 */
export class JSONColumnType implements Type {
	selectType: Type;
	insertType?: Type;
	updateType?: Type;

	constructor(selectType: Type, insertType?: Type, updateType?: Type) {
		this.selectType = selectType;
		this.insertType = insertType;
		this.updateType = updateType;
	}

	get typeParameters(): Type[] {
		return normalizeTypeParams(
			[this.selectType, this.insertType, this.updateType],
			{ type: "string" },
		);
	}

	get type(): string {
		return `JSONColumnType<${this.typeParameters.map((t) => t.type).join(", ")}>`;
	}

	get imports(): TypeImport[] | undefined {
		return [
			...this.typeParameters.flatMap((t) => t?.imports ?? []),
			{
				moduleSpecifier: "kysely",
				namedBindings: ["JSONColumnType"],
			},
		];
	}
}

/**
 * Represents a Kysely Generated utility type.
 */
export class Generated implements Type {
	selectType: Type;

	constructor(selectType: Type) {
		this.selectType = selectType;
	}

	get type(): string {
		return `Generated<${this.selectType.type}>`;
	}

	get imports(): TypeImport[] | undefined {
		return [
			...(this.selectType.imports ?? []),
			{
				moduleSpecifier: "kysely",
				namedBindings: ["Generated"],
			},
		];
	}
}

export class GeneratedAlways implements Type {
	selectType: Type;

	constructor(selectType: Type) {
		this.selectType = selectType;
	}

	get type(): string {
		return `GeneratedAlways<${this.selectType.type}>`;
	}

	get imports(): TypeImport[] | undefined {
		return [
			...(this.selectType.imports ?? []),
			{
				moduleSpecifier: "kysely",
				namedBindings: ["GeneratedAlways"],
			},
		];
	}
}

type AnyColumnType = ColumnType | JSONColumnType | Generated | GeneratedAlways;

export function isColumnType(type: Type): type is AnyColumnType {
	return !!(type as AnyColumnType).selectType;
}

function createImportedType(name: string, from: string): Type {
	return createType(name, [
		{
			moduleSpecifier: from,
			namedBindings: [name],
		},
	]);
}

// biome-ignore lint/suspicious/noExplicitAny: leave me alone
function newClass<C extends new (...args: any[]) => any>(
	Constructor: C,
): (...args: ConstructorParameters<C>) => InstanceType<C> {
	return (...args) => new Constructor(...args);
}

const undefinedType = createType("undefined");
const nullType = createType("null");

export const Type = {
	create: createType,
	number: createType("number"),
	string: createType("string"),
	boolean: createType("boolean"),
	bigint: createType("bigint"),
	null: nullType,
	undefined: undefinedType,
	never: createType("never"),
	any: createType("any"),
	unknown: createType("unknown"),
	Date: createType("Date"),
	stringLiteral: newClass(StringLiteral),
	numericLiteral: newClass(NumericLiteral),
	array: newClass(ArrayType),
	union: newClass(UnionType),
	intersection: newClass(IntersectionType),
	nullable: (type: Type): Type => new UnionType(type, nullType),
	optional: (type: Type): Type => new UnionType(type, undefinedType),
	imported: createImportedType,
	buffer: createImportedType("Buffer", "node:buffer"),
	columnType: newClass(ColumnType),
	jsonColumnType: newClass(JSONColumnType),
	generated: newClass(Generated),
	generatedAlways: newClass(GeneratedAlways),
} as const;
