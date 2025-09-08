import { classify } from "inflected";
import { ImportCollection } from "./imports.ts";
import {
	type Declaration,
	type ImportDeclaration,
	type InterfaceDeclaration,
	Printer,
	type PrinterOptions,
} from "./printer.ts";
import type { TableMetadata, TypeCollector } from "./type-collector.ts";

/**
 * Generate types based on the given configuration.
 */
export async function generateTypes(
	typeCollector: TypeCollector,
	printerOptions: PrinterOptions = {},
): Promise<string> {
	const tables = await typeCollector.collectTables();

	const declarations = assembleTypes(tables);

	const output = new Printer(printerOptions).print(declarations);

	return output;
}

/**
 * Assemble the type declarations for the Kysely Database interface and all
 * table types.
 */
export function assembleTypes(tables: TableMetadata[]): Declaration[] {
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
	for (const table of tables) {
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
			const {
				name,
				columnType: { type, imports: typeImports },
				comment,
			} = column;

			imports.add(...(typeImports ?? []));

			tableType.properties.push({
				name,
				type,
				comment,
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
