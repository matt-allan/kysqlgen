import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import pkg from "./../package.json" with { type: "json" };
import {
	CONFIG_FILENAME,
	loadConfig,
	locateConfig,
	resolveConfig,
} from "./config.ts";
import { generateTypes } from "./generate.ts";

export async function cli(args: string[]): Promise<number> {
	const { values } = parseArgs({
		args,
		options: {
			config: {
				type: "string",
				short: "c",
			},
			cwd: {
				type: "string",
				default: process.cwd(),
			},
			write: {
				type: "boolean",
			},
			help: {
				type: "boolean",
				short: "h",
			},
		},
	});

	if (values.help) {
		const helpText = `Usage: ${Object.keys(pkg.bin)[0]} [OPTIONS]

Available options:

--config, -c      Path to the config file
--cwd             The current working directory to use
--write           Write output to the filesystem
--help, -h        Prints help information
`;
		process.stdout.write(helpText);

		return 0;
	}

	const configPath = values.config ?? locateConfig(values.cwd);

	if (!configPath) {
		console.error(`Unable to locate config file ${CONFIG_FILENAME}`);
		return 1;
	}

	const config = await loadConfig(configPath);

	const { db, dialect, outFile, printerOptions } = await resolveConfig(config);

	const typeCollector = dialect.createTypeCollector(db);

	const output = await generateTypes(typeCollector, printerOptions);

	if (values.write) {
		await writeFile(outFile ?? "db.d.ts", output, "utf-8");
	} else {
		process.stdout.write(output);
	}

	await db.destroy();

	return 0;
}
