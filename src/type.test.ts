import assert from "node:assert";
import { test } from "node:test";
import { createType, Type } from "./type.ts";

test("Type", () => {
	const basicTypes = [
		"number",
		"string",
		"boolean",
		"bigint",
		"null",
		"undefined",
		"never",
		"any",
		"unknown",
		"Date",
	];

	const tests: Record<string, [Type, string]> = {
		...Object.fromEntries(
			basicTypes.map((t) => [t, [Type[t as keyof typeof Type], t]]),
		),
		stringLiteral: [Type.stringLiteral("foo"), `"foo"`],
		numericLiteral: [Type.numericLiteral(123), `123`],
		shortArray: [Type.array(Type.number), "number[]"],
		fullArray: [
			Type.array(createType("{ n: number }")),
			`Array<{ n: number }>`,
		],
		union: [
			Type.union(Type.stringLiteral("a"), Type.stringLiteral("b")),
			`"a" | "b"`,
		],
		intersection: [
			Type.intersection(createType(`{x: number}`), createType(`{y: number}`)),
			`{x: number} & {y: number}`,
		],
		nullable: [Type.nullable(Type.number), `number | null`],
		optional: [Type.optional(Type.number), `number | undefined`],
		imported: [Type.imported("Buffer", "node:buffer"), `Buffer`],
		buffer: [Type.buffer, `Buffer`],
		ColumnType: [
			Type.columnType(Type.unknown, Type.string),
			`ColumnType<unknown, string>`,
		],
		JSONColumnType: [
			Type.jsonColumnType(Type.unknown),
			`JSONColumnType<unknown>`,
		],
		Generated: [Type.generated(Type.bigint), `Generated<bigint>`],
		GeneratedAlways: [
			Type.generatedAlways(Type.bigint),
			`GeneratedAlways<bigint>`,
		],
	};

	for (const [name, [type, output]] of Object.entries(tests)) {
		test(name, () => assert.strictEqual(type.type, output));
	}
});
