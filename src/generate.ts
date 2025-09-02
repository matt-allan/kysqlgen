import { classify } from "inflected";
import type { Kysely } from "kysely";
import type { Config } from "./config.ts";
import { ImportCollection } from "./imports.ts";
import type { DatabaseIntrospector, TableMetadata } from "./introspector.ts";
import { createMysqlIntrospector } from "./mysql/introspector.ts";
import {
	type Declaration,
	type ImportDeclaration,
	type InterfaceDeclaration,
	Printer,
} from "./printer.ts";

/**
 * Generate types based on the given configuration.
 */
export async function generateTypes(config: Config): Promise<string> {
	const { db, introspector } = await createIntrospector(config);

	const tableMeta = await introspector.getTables();

	const declarations = collectTypes(tableMeta);

	const output = new Printer(config.printerOptions).print(declarations);

	await db.destroy();

	return output;
}

async function createIntrospector(config: Config): Promise<{
	db: Kysely<unknown>;
	introspector: DatabaseIntrospector;
}> {
	switch (config.dialect) {
		case "mysql2": {
			const { db, introspector } = await createMysqlIntrospector(
				config.dialectConfig,
				config.introspectorOptions,
			);

			return { db, introspector };
		}
		default:
			throw new Error(`Unsupported dialect ${config.dialect}`);
	}
}

/**
 * Collect the table metadata into declarations for generated type definition file.
 */
function collectTypes(tableMeta: TableMetadata[]): Declaration[] {
	const imports = new ImportCollection();
	const declarations: Declaration[] = [];

	// Create the main Database type
	const dbType: InterfaceDeclaration = {
		kind: "interface",
		name: "Database",
		properties: [], // filled in as we add tables
	};
	declarations.push(dbType);

	// Map every table
	for (const table of tableMeta) {
		const className = classify(table.name);
		const tableType: InterfaceDeclaration = {
			kind: "interface",
			name: `${className}Table`,
			properties: [],
			comment: table.comment,
		};

		// Add the table type to the Database interface
		dbType.properties.push({
			name: table.name,
			type: tableType.name,
		});

		// Map the table's columns
		for (const column of table.columns) {
			const tsType = column.tsType;

			if (tsType.imports) {
				imports.add(...tsType.imports);
			}

			tableType.properties.push({
				name: column.name,
				type: tsType.type,
				comment: column.comment,
			});
		}

		declarations.push(tableType);
		declarations.push({
			kind: "type",
			name: className,
			type: `Selectable<${tableType.name}>`,
		});
		imports.addNamed("kysely", "Selectable");
		declarations.push({
			kind: "type",
			name: `New${className}`,
			type: `Insertable<${tableType.name}>`,
		});
		imports.addNamed("kysely", "Insertable");
		declarations.push({
			kind: "type",
			name: `${className}Update`,
			type: `Updateable<${tableType.name}>`,
		});
		imports.addNamed("kysely", "Updateable");
	}

	// Prepend the import declarations
	const importDeclarations: ImportDeclaration[] = imports
		.values()
		.map((imp) => ({ kind: "import", ...imp }));

	declarations.unshift(...importDeclarations);

	return declarations;
}
