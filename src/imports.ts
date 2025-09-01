export interface TypeImport {
	/** The module you are importing from */
	moduleSpecifier: string;
	/** The default import name, if any */
	defaultImport?: string;
	/** The named import bindings  */
	namedBindings?: ImportSpecifier[];
}

export type ImportSpecifier =
	| string
	| {
			/** The identifier being imported */
			name: string;
			/** The alias, e.g. "foo" in `as foo` */
			alias: string;
	  };

export class ImportCollection {
	#imports: Map<
		string,
		Omit<TypeImport, "namedBindings"> & { namedBindings?: Set<ImportSpecifier> }
	> = new Map();

	add(...typeImports: TypeImport[]) {
		for (const typeImport of typeImports) {
			this.#addImport(typeImport);
		}
	}

	#addImport(typeImport: TypeImport) {
		const { moduleSpecifier, defaultImport, namedBindings } = typeImport;

		if (defaultImport) {
			this.addDefault(moduleSpecifier, defaultImport);
		}
		if (namedBindings) {
			this.addNamed(moduleSpecifier, ...namedBindings);
		}
	}

	addNamed(moduleSpecifier: string, ...names: ImportSpecifier[]) {
		let typeImport = this.#imports.get(moduleSpecifier);

		if (!typeImport) {
			typeImport = {
				moduleSpecifier,
			};
      this.#imports.set(typeImport.moduleSpecifier, typeImport);
		}

		typeImport.namedBindings ??= new Set();
		for (const name of names) {
			typeImport.namedBindings.add(name);
		}
	}

	addDefault(moduleSpecifier: string, name: string) {
		let typeImport = this.#imports.get(moduleSpecifier);

		if (!typeImport) {
			typeImport = {
				moduleSpecifier,
			};
      this.#imports.set(typeImport.moduleSpecifier, typeImport);
		}

		if (typeImport.defaultImport && typeImport.defaultImport !== name) {
			throw new Error(
				`Conflicting default imports for "${moduleSpecifier}": "${typeImport.defaultImport}", "${name}"`,
			);
		}

		typeImport.defaultImport = name;
	}

	values(): TypeImport[] {
		return this.#imports
			.values()
			.toArray()
			.filter((imp) => imp.defaultImport || imp.namedBindings?.size)
			.map((imp) => ({
				...imp,
				namedBindings: imp.namedBindings?.values().toArray() ?? [],
			}))
			.toSorted((a, b) => a.moduleSpecifier.localeCompare(b.moduleSpecifier));
	}
}
