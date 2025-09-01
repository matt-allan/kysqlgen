import type { ImportSpecifier, TypeImport } from "./imports.ts";

export const Kind = {
	Import: "import",
	Type: "type",
	Interface: "interface",
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

export type ImportDeclaration = {
	kind: "import";
} & TypeImport;

export interface TypeDeclaration {
	kind: "type";
	comment?: string;
	name: string;
	type: string;
}

export interface PropertySignature {
	comment?: string;
	name: string;
	type: string;
}

export interface InterfaceDeclaration {
	kind: "interface";
	comment?: string;
	name: string;
	properties: PropertySignature[];
}

export type Declaration =
	| ImportDeclaration
	| TypeDeclaration
	| InterfaceDeclaration;

export interface PrinterOptions {
	indentStyle?: "tab" | "space";
	indentWidth?: number;
	semicolons?: boolean;
}

const defaultOptions: Required<PrinterOptions> = {
	indentStyle: "space",
	indentWidth: 2,
	semicolons: true,
};

export class Printer {
	#space: string;
	#semi: string;

	constructor(opts: PrinterOptions = {}) {
		const { indentStyle, indentWidth, semicolons } = {
			...defaultOptions,
			...opts,
		};

		this.#space = (indentStyle === "tab" ? "\t" : " ").repeat(indentWidth);
		this.#semi = semicolons ? ";" : "";
	}

	print(declarations: Declaration[]): string {
		const chunks: string[] = [];

		// We have to split the imports and remaining types so that imports can be
		// written first, with a single newline between each import and a blank line
		// after the imports. All subsequent types are written in the order they
		// were provided with a blank line between them.
		const [imports, types] = declarations.reduce(
			([imports, types], current) => {
				if (current.kind === Kind.Import) {
					imports.push(current);
				} else {
					types.push(current);
				}
				return [imports, types];
			},
			[[], []] as [
				ImportDeclaration[],
				Array<TypeDeclaration | InterfaceDeclaration>,
			],
		);

		for (const decl of imports) {
			chunks.push(this.printImport(decl));
		}
		if (imports.length) {
			chunks.push("\n");
		}

		for (const decl of types) {
			switch (decl.kind) {
				case Kind.Type:
					chunks.push(this.printType(decl));
					break;
				case Kind.Interface:
					chunks.push(this.printInterface(decl));
					break;
				default:
					throw new Error(
						`Unknown declaration kind: ${(decl as Declaration).kind}`,
					);
			}
			chunks.push("\n");
		}

		return chunks.join("");
	}

	printImport(decl: ImportDeclaration): string {
		const { moduleSpecifier, defaultImport, namedBindings } = decl;

		const printSpecifier = (name: ImportSpecifier): string =>
			typeof name === "string" ? name : `${name.name} as ${name.alias}`;

		return [
			"import type ",
			defaultImport ? `${defaultImport}${namedBindings ? ", " : ""}` : "",
			namedBindings
				? `{ ${namedBindings.map(printSpecifier).join(", ")} }`
				: "",
			` from "${moduleSpecifier}"`,
			this.#semi,
			"\n",
		].join("");
	}

	printType(decl: TypeDeclaration): string {
		// TODO: write comments
		return `export type ${decl.name} = ${decl.type}${this.#semi}\n`;
	}

	printInterface(decl: InterfaceDeclaration): string {
		const chunks: string[] = [];

		chunks.push(
			// TODO: write comments
			`export interface ${decl.name} {\n`,
		);

		const indent = this.#space;
		for (const prop of decl.properties) {
			chunks.push(
				// TODO: write comments
				`${indent}${prop.name}: ${prop.type}${this.#semi}\n`,
			);
		}

		chunks.push(`}\n`);

		return chunks.join("");
	}
}
