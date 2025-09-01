import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { CONFIG_FILENAME, loadConfig, locateConfig } from "./config.ts";
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
		const helpText = `Usage: kysqlgen [OPTIONS]

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

	const output = await generateTypes(config);

	if (values.write) {
		await writeFile(config.outFile ?? "db.d.ts", output, "utf-8");
	} else {
		process.stdout.write(output);
	}

	return 0;
}
