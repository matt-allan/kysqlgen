import assert from "node:assert";
import { test } from "node:test";
import { ImportCollection } from "./imports.ts";

test("ImportCollection", () => {
	test("addNamed", () => {
		const collection = new ImportCollection();

		collection.addNamed("kysely", "ColumnType");
		collection.addNamed("kysely", "ColumnType");
		collection.addNamed("kysely", "JSONColumnType");
		collection.addNamed("kysely", "Generated");

		const imports = collection.values();

		assert.strictEqual(imports.length, 1);
		// biome-ignore lint/style/noNonNullAssertion: just verified this
		const typeImport = imports[0]!;

		assert.deepStrictEqual(typeImport, {
			moduleSpecifier: "kysely",
			namedBindings: ["ColumnType", "Generated", "JSONColumnType"],
		});
	});

	test("addDefault", () => {
		const collection = new ImportCollection();

		collection.addDefault("node:assert", "assert");

		const imports = collection.values();

		assert.strictEqual(imports.length, 1);
		// biome-ignore lint/style/noNonNullAssertion: just verified this
		const typeImport = imports[0]!;

		assert.deepStrictEqual(typeImport, {
			moduleSpecifier: "node:assert",
			defaultImport: "assert",
			namedBindings: [],
		});
	});

	test("values", () => {
		const collection = new ImportCollection();

		collection.addNamed("node:buffer", "Buffer");
		collection.addNamed("kysely", "Selectable");
		collection.addNamed("kysely", "Updateable");
		collection.addNamed("kysely", "Generated");

		const imports = collection.values();

		assert.strictEqual(imports.length, 2);

		assert.deepStrictEqual(imports, [
			// Imports should be sorted by module specifier, with bindings by name
			{
				moduleSpecifier: "kysely",
				namedBindings: ["Generated", "Selectable", "Updateable"],
			},
			{
				moduleSpecifier: "node:buffer",
				namedBindings: ["Buffer"],
			},
		]);
	});
});
