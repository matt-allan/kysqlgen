#!/usr/bin/env node
import { cli } from "./cli.ts";

const exitCode = await cli(process.argv.slice(2));

process.exitCode = exitCode;
