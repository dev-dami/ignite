#!/usr/bin/env bun

import { $ } from "bun";
import { mkdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";

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
      await $`tar -czvf ${join(DIST_DIR, tarName)} -C ${BIN_DIR} ${name} -C ${DIST_DIR} runtime-bun`.quiet();
      console.log(`   ✓ Created ${tarName}`);
    } catch (err) {
      console.error(`   ✗ Failed to create ${tarName}`);
    }
  }

  console.log("\n✓ Build complete!");
  console.log(`  Binaries: ${BIN_DIR}`);
  console.log(`  Archives: ${DIST_DIR}`);
}

build().catch(console.error);
