import { defineConfig } from "kysqlgen";
import { createPool } from "mysql2";

export default defineConfig({
	dialect: "mysql2",
	dialectConfig: {
		pool: createPool(process.env.MYSQL_URI ?? ""),
	},
	outFile: "db.d.ts",
	printer: {
		indentStyle: "space",
		indentWidth: 2,
		semicolons: true,
	},
});
