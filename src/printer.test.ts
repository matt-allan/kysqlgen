import assert from "node:assert";
import test from "node:test";
import { Kind, Printer } from "./printer.ts";

test("Printer", (t) => {
	const printer = new Printer();

	t.test("imports", () => {
		const code = printer.printImport({
			kind: Kind.Import,
			moduleSpecifier: "kysely",
			namedBindings: ["Generated", "ColumnType"],
		});

		const expected = `import type { Generated, ColumnType } from "kysely";\n`;

		assert.strictEqual(code, expected);

		t.test("default import", () => {
			const code = printer.printImport({
				kind: Kind.Import,
				moduleSpecifier: "node:buffer",
				defaultImport: "Buffer",
			});

			const expected = `import type Buffer from "node:buffer";\n`;

			assert.strictEqual(code, expected);
		});
	});

	t.test("type", () => {
		const code = printer.printType({
			kind: Kind.Type,
			name: "Person",
			type: "Selectable<PersonTable>",
		});

		const expected = `export type Person = Selectable<PersonTable>;\n`;

		assert.strictEqual(code, expected);
	});

	t.test("type with comment", () => {
		const code = printer.printType({
			kind: Kind.Type,
			name: "Person",
			type: "Selectable<PersonTable>",
			comment: "This is a person.",
		});

		const expected = `
/**
 * This is a person.
 */
export type Person = Selectable<PersonTable>;\n`.trimStart();

		assert.strictEqual(code, expected);
	});

	t.test("interface", () => {
		const code = printer.printInterface({
			kind: Kind.Interface,
			name: "PersonTable",
			properties: [
				{
					name: "id",
					type: "Generated<number>",
				},
				{
					name: "first_name",
					type: "string",
				},
			],
		});

		const expected = `export interface PersonTable {
  id: Generated<number>;
  first_name: string;
}\n`;

		assert.strictEqual(code, expected);
	});
});
