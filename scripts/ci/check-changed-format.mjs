import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const supportedExtensions = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".css",
  ".md",
  ".mdx",
  ".yaml",
  ".yml",
]);

function fail(message) {
  process.stderr.write(`format:check:changed: ${message}\n`);
  process.exitCode = 1;
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "buffer" });
  if (result.status !== 0) {
    const detail = result.stderr.toString().trim();
    throw new Error(detail || `git ${args[0]} failed`);
  }
  return result.stdout;
}

function parseBaseArgument(args) {
  const baseIndex = args.indexOf("--base");
  if (baseIndex === -1 || args.length !== 2 || !args[baseIndex + 1])
    throw new Error("expected exactly --base <git-revision>");
  const base = args[baseIndex + 1];
  if (base.startsWith("-"))
    throw new Error("base revision must not start with '-'");
  git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  return base;
}

function nulSeparated(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function isSupported(path) {
  const fileName = path.toLowerCase();
  return [...supportedExtensions].some((extension) =>
    fileName.endsWith(extension),
  );
}

function changedSupportedFiles(base) {
  const changed = nulSeparated(
    git(["diff", "--name-only", "-z", "--diff-filter=ACMR", base, "--"]),
  );
  const untracked = nulSeparated(
    git(["ls-files", "--others", "--exclude-standard", "-z"]),
  );
  return [...new Set([...changed, ...untracked])]
    .filter(isSupported)
    .sort((left, right) => left.localeCompare(right));
}

try {
  const base = parseBaseArgument(process.argv.slice(2));
  const files = changedSupportedFiles(base);
  if (files.length === 0) {
    process.stdout.write("format:check:changed: no supported files changed\n");
  } else {
    const prettier = fileURLToPath(
      new URL("../../node_modules/prettier/bin/prettier.cjs", import.meta.url),
    );
    if (!existsSync(prettier))
      throw new Error(
        "repository-installed Prettier was not found; run npm ci first",
      );
    process.stdout.write(
      `format:check:changed: checking ${files.length} supported file(s)\n`,
    );
    const result = spawnSync(
      process.execPath,
      [prettier, "--check", ...files],
      {
        stdio: "inherit",
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status || 1;
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "unexpected failure");
}
