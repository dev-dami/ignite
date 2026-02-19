#!/usr/bin/env bun

import { $ } from "bun";
import { mkdir, rm, copyFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(import.meta.dir, "..");
const BIN_DIR = join(ROOT, "bin");
const DIST_DIR = join(ROOT, "dist");

const TARGETS = [
  { name: "ignite-linux-x64", target: "bun-linux-x64" },
  { name: "ignite-linux-arm64", target: "bun-linux-arm64" },
  { name: "ignite-darwin-x64", target: "bun-darwin-x64" },
  { name: "ignite-darwin-arm64", target: "bun-darwin-arm64" },
];

async function build() {
  console.log("Building Ignite CLI binaries...\n");
  const failures: string[] = [];

  await rm(BIN_DIR, { recursive: true, force: true });
  await mkdir(BIN_DIR, { recursive: true });

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  console.log("1. Building TypeScript...");
  await $`bun run build`.cwd(ROOT);

  console.log("\n2. Creating bundle...");
  const entryPoint = join(ROOT, "packages/cli/dist/index.js");

  for (const { name, target } of TARGETS) {
    console.log(`\n   Compiling for ${target}...`);
    const outPath = join(BIN_DIR, name);

    try {
      await $`bun build ${entryPoint} --compile --target=${target} --outfile=${outPath}`.cwd(ROOT);
      console.log(`   ✓ Created ${name}`);
    } catch (err) {
      console.error(`   ✗ Failed to create ${name}: ${err}`);
      failures.push(`compile:${target}`);
    }
  }

  console.log("\n3. Copying runtime Dockerfiles...");
  await mkdir(join(DIST_DIR, "runtime-bun"), { recursive: true });

  await copyFile(
    join(ROOT, "packages/runtime-bun/Dockerfile"),
    join(DIST_DIR, "runtime-bun/Dockerfile")
  );

  console.log("\n4. Creating release archives...");
  for (const { name, target } of TARGETS) {
    const binPath = join(BIN_DIR, name);
    const tarName = `${name}.tar.gz`;

    try {
      const binary = Bun.file(binPath);
      if (!(await binary.exists())) {
        throw new Error(`missing binary ${name}`);
      }
      await $`tar -czvf ${join(DIST_DIR, tarName)} -C ${BIN_DIR} ${name} -C ${DIST_DIR} runtime-bun`.quiet();
      console.log(`   ✓ Created ${tarName}`);
    } catch (err) {
      console.error(`   ✗ Failed to create ${tarName}: ${err}`);
      failures.push(`archive:${target}`);
    }
  }

  console.log("\n5. Generating SHA256 checksums...");
  const releaseArchives = (await readdir(DIST_DIR))
    .filter((file) => file.endsWith(".tar.gz"))
    .sort();
  const checksums: string[] = [];
  for (const archive of releaseArchives) {
    const contents = await readFile(join(DIST_DIR, archive));
    const hash = createHash("sha256").update(contents).digest("hex");
    checksums.push(`${hash}  ${archive}`);
  }
  await Bun.write(join(DIST_DIR, "SHA256SUMS"), checksums.join("\n") + "\n");
  console.log("   ✓ Wrote SHA256SUMS");

  if (failures.length > 0) {
    throw new Error(`Build failed for one or more targets: ${failures.join(", ")}`);
  }

  console.log("\n✓ Build complete!");
  console.log(`  Binaries: ${BIN_DIR}`);
  console.log(`  Archives: ${DIST_DIR}`);
}

build().catch(console.error);
