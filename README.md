# kysqlgen

Generate [Kysely](https://kysely.dev/) database types from a MySQL database.

## Overview

This package generates a TypeScript type declaration file from your database by examining the information schema.

The generated output looks like this:

```typescript
import type { Generated, Selectable, Insertable, Updateable } from "kysely";

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
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type User = Selectable<UserTable>;

export type NewUser = Insertable<UserTable>;

export type UserUpdate = Updateable<UserTable>;
```

Types are mapped based on the mysql2 defaults and any configuration settings on the pool.

The type names are derived from the table names using the [inflected package](https://github.com/martinandert/inflected).

## Setup

Install the package:

```bash
npm install --save-dev kysqlgen
```

Create a `kysqlgen.config.ts` config file in your project root:

```typescript
import { defineConfig } from "kysqlgen";
import { createPool } from "mysql2";

export default defineConfig({
	dialect: "mysql2",
	dialectConfig: {
		pool: createPool(process.env.MYSQL_URI),
	},
	outFile: "db.d.ts",
	printerOptions: {
		indentStyle: "tab",
		indentWidth: 2,
		semicolons: true,
	},
});
```

## CLI Usage

To generate types and write to `outFile`:

```bash
npx kysqlgen --write
```

## Library usage

```typescript
import { defineConfig, generateTypes } from "kysqlgen";

const config = defineConfig({
    // ...
});

const output = await generateTypes(config);
```