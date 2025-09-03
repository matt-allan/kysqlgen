import pkg from "./../package.json" with { type: "json" };

export const PKG_NAME = pkg.name;
// biome-ignore lint/style/noNonNullAssertion: it better exist
export const BIN_NAME = Object.keys(pkg.bin)[0]!;
export const PKG_VERSION = pkg.version;
