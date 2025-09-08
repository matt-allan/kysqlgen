# kysqlgen

Generate [Kysely](https://kysely.dev/) database types from a database schema.

## Overview

This package generates a TypeScript type declaration file from your database by
examining the information schema.

The generated output looks like this:

```typescript
import type {
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from "kysely";

export interface Database {
  addresses: AddressTable;
  users: UserTable;
  // ...
}

// ...

export interface UserTable {
  id: Generated<number>;
  public_id: string;
  email: string | null;
  name: string | null;
  status: Generated<"active" | "inactive">;
  preferences: JSONColumnType<{ theme: "light" }>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type User = Selectable<UserTable>;

export type NewUser = Insertable<UserTable>;

export type UserUpdate = Updateable<UserTable>;
```

## Features

- Accurate type mapping based on your database driver's configuration
- Preserves database column order in output types
- Supports Kysely's `ColumnType`, `JSONColumnType`, `Generated`, and
  `GeneratedAlways` wrappers
- Dialect specific type casts and column overrides
- Use any inline type definition or imported type
- Automatic inflection of type names from table names using the
  [inflected package](https://github.com/martinandert/inflected).

## Supported dialects

Currently only MySQL (`mysql2`) and SQLite (`better-sqlite3`) are supported. Pull requests will be accepted for additional dialects. Get in touch if you have questions.

## Supported runtimes

Currently only Node.js v24+ is supported. That being said, most of the code is not Node.js specific. Pull requests are welcome for multi-runtime support.


## Installation

```bash
# NPM
npm i -D kysqlgen
# Yarn
yarn add -D kysqlgen
# pnpm
pnpm add -D kysqlgen
```

## Configuration

Create a `kysqlgen.config.ts` config file in your project root. You can also
place the file in a `.config` folder inside the project root.

```typescript
import { defineConfig } from "kysqlgen";
import { createPool } from "mysql2";

export default defineConfig({
  dialect, // The name of the Kysely dialect, e.g. "mysql2"
  dialectConfig, // Configuration for the Kysely dialect
  typeConfig, // Optional dialect specific type mapping configuration
  outFile, // The output filename
  printerOptions, // Configures formatting (e.g. indentation) for the output
});
```

The configuration file is loaded using Node's native type stripping, so take care to only use [erasable syntax](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8-beta/#the---erasablesyntaxonly-option) in the config file and it's imports.

### Mysql

```typescript
import { defineConfig, Type } from "kysqlgen";
import { createPool } from "mysql2";

export default defineConfig({
  dialect: "mysql2",
  dialectConfig: {
    pool: createPool(process.env.MYSQL_URI),
  },
  typeConfig: {
    // A map of MySQL column types to TypeScript types to use.
    // This should match the typeCasts configured on the mysql2 pool.
    typeCasts: {
      "tinyint(1)": Type.boolean,
      "bigint": Type.bigint,
    },
    // A map of table qualified column names to types to use for JSON columns.
    // The type is used instead of "unknown" for the select type.
    jsonColumns: {
      "posts.tags": Type.array(Type.string),
    },
  },
  // ...
});
```

### Sqlite

```typescript
import SQLite from 'better-sqlite3'
import { defineConfig, Type } from "kysqlgen";

export default defineConfig({
  dialect: "better-sqlite3",
  dialectConfig: {
    database: new SQLite(process.env.SQLITE_DB_PATH),
  },
  typeConfig: {
    // A map of table qualified column names to types to use.
    // This can be used for more specific types than the default,
    // e.g. a string literal union for an enum TEXT column.
    columnCasts: {
      "users.status": Type.union(
        Type.stringLiteral("active"),
        Type.stringLiteral("inactive"),
      ),
    }
  }
  // ...
});
```

## Usage

Run the `kysqlgen` CLI to generate types.

The types are written to stdout by default. To write to the configured `outFile`, pass the `--write` flag:

```bash
npx kysqlgen --write
```

## Advanced configuration

### Custom types

When mapping your own types, you must return a `Type` object:

```typescript
/**
 * A type definition for a Typescript type.
 */
export interface Type {
	type: string;
	imports?: TypeImport[];
}
```

The `type` property is the actual type definition string that will be used verbatim in the output file. The `imports` property can be used to specify any type imports necessary for the type.

For common types there are utility functions on the the runtime `Type` object. For example:

```typescript
const t = Type.jsonColumnType(
    Type.union(Type.stringLiteral("active"), Type.stringLiteral("inactive"))
); // JSONColumnType<"active" | "inactive">
```

`Type.create` function lets you create an arbitrary type when a utility is not available:

```typescript
const communicationPreferencesType = Type.create(
    `RequireAtLeastOne<{email: boolean, text: boolean}>`,
    [{ moduleSpecifier: "type-fest", namedBindings: ["RequireAtLeastOne"]}],
);
```

Note that `Type.create` should not be used for `ColumnType` or a `ColumnType` alias. Nest the utilities instead:

```typescript
// ✅ Wrapping with the dedicated utility
const communicationPreferencesType = Type.jsonColumnType(Type.create(
    // ...
));
```

## Inflection rules

The [inflected](https://github.com/martinandert/inflected) package is used to convert table names to type names. More specifically, we use the [`Inflector.classify`](https://github.com/martinandert/inflected?tab=readme-ov-file#inflectorclassify) function.

To customize the inflection rules, use the [`Inflector.inflections`](https://github.com/martinandert/inflected?tab=readme-ov-file#inflectorinflections) singleton from the `inflected` package. You can place the call at the top of your config file.