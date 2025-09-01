import assert from "node:assert";
import test from "node:test";
import { Kind, Printer } from "./printer.ts";

test("Printer", (t) => {
	const printer = new Printer();

	t.test("imports", () => {
		const code = printer.print([
			{
				kind: Kind.Import,
				moduleSpecifier: "kysely",
				namedBindings: ["Generated", "ColumnType"],
			},
			{
				kind: Kind.Import,
				moduleSpecifier: "node:buffer",
				namedBindings: ["Buffer"],
			},
		]);

		const expected = [
			`import type { Generated, ColumnType } from "kysely";`,
			`import type { Buffer } from "node:buffer";`,
			"\n", // trailing newline
		].join("\n");

		assert.strictEqual(code, expected);

		t.test("default import", () => {
			const code = printer.print([
				{
					kind: Kind.Import,
					moduleSpecifier: "node:buffer",
					defaultImport: "Buffer",
				},
			]);

			const expected = `import type Buffer from "node:buffer";\n\n`;

			assert.strictEqual(code, expected);
		});
	});

	t.test("type", () => {
		const code = printer.print([
			{
				kind: Kind.Type,
				name: "Person",
				type: "Selectable<PersonTable>",
			},
		]);

		const expected = `export type Person = Selectable<PersonTable>;\n\n`;

		assert.strictEqual(code, expected);
	});

	t.test("interface", () => {
		const code = printer.print([
			{
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
			},
		]);

		const expected = `export interface PersonTable {
  id: Generated<number>;
  first_name: string;
}\n\n`;

		assert.strictEqual(code, expected);
	});
});
