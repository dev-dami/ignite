#!/usr/bin/env bun

import { $ } from "bun";

const REPO = "dev-dami/ignite";

type BumpType = "major" | "minor" | "patch" | null;

async function getLastTag(): Promise<string | null> {
  try {
    const result = await $`git describe --tags --abbrev=0 2>/dev/null`.text();
    return result.trim() || null;
  } catch {
    return null;
  }
}

async function getCommitsSinceTag(tag: string | null): Promise<string[]> {
  try {
    const range = tag ? `${tag}..HEAD` : "HEAD";
    const result = await $`git log ${range} --pretty=format:%s`.text();
    return result.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function determineBumpType(commits: string[]): BumpType {
  let hasBreaking = false;
  let hasFeat = false;
  let hasFix = false;

  for (const commit of commits) {
    const lower = commit.toLowerCase();
    
    if (lower.includes("breaking") || lower.includes("!:")) {
      hasBreaking = true;
    }
    if (lower.startsWith("feat")) {
      hasFeat = true;
    }
    if (lower.startsWith("fix")) {
      hasFix = true;
    }
  }

  if (hasBreaking) return "major";
  if (hasFeat) return "minor";
  if (hasFix) return "patch";
  return null;
}

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = current.replace("v", "").split(".").map(Number);
  
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return current;
  }
}

async function getCurrentVersion(): Promise<string> {
  const pkg = await Bun.file("package.json").json();
  return pkg.version;
}

async function updatePackageVersion(version: string): Promise<void> {
  const packages = [
    "package.json",
    "packages/cli/package.json",
    "packages/core/package.json",
    "packages/http/package.json",
    "packages/shared/package.json",
    "packages/runtime-bun/package.json",
    "packages/runtime-node/package.json",
  ];
  
  for (const pkgPath of packages) {
    try {
      const pkg = await Bun.file(pkgPath).json();
      pkg.version = version;
      await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    } catch {}
  }
  
  const cliIndexPath = "packages/cli/src/index.ts";
  let cliIndex = await Bun.file(cliIndexPath).text();
  cliIndex = cliIndex.replace(/\.version\(['"][\d.]+['"]\)/, `.version('${version}')`);
  await Bun.write(cliIndexPath, cliIndex);
}

async function main() {
  console.log("\n🚀 Ignite Release Tool\n");

  const lastTag = await getLastTag();
  console.log(`Last tag: ${lastTag || "none"}`);

  const commits = await getCommitsSinceTag(lastTag);
  
  if (commits.length === 0) {
    console.log("❌ No commits since last release");
    process.exit(1);
  }

  console.log(`\nCommits since ${lastTag || "beginning"}:`);
  commits.slice(0, 10).forEach(c => console.log(`  • ${c}`));
  if (commits.length > 10) {
    console.log(`  ... and ${commits.length - 10} more`);
  }

  const bumpType = determineBumpType(commits);
  
  if (!bumpType) {
    console.log("\n❌ No feat/fix commits found. Nothing to release.");
    console.log("   Use 'feat:' for features, 'fix:' for bug fixes");
    process.exit(1);
  }

  const currentVersion = await getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, bumpType);
  const tag = `v${newVersion}`;

  console.log(`\n📦 Version bump: ${currentVersion} → ${newVersion} (${bumpType})`);
  
  const confirm = prompt(`\nProceed with release ${tag}? [y/N] `);
  if (confirm?.toLowerCase() !== "y") {
    console.log("Cancelled");
    process.exit(0);
  }

  console.log("\n📝 Updating package.json...");
  await updatePackageVersion(newVersion);

  console.log("📦 Committing...");
  await $`git add package.json packages/*/package.json packages/cli/src/index.ts`;
  await $`git commit -m "chore(release): ${tag}"`;

  console.log("🏷️  Creating tag...");
  await $`git tag ${tag}`;

  console.log("🚀 Pushing...");
  await $`git push origin master`;
  await $`git push origin ${tag}`;

  console.log(`\n✅ Released ${tag}`);
  console.log(`\n📦 CI will build binaries: https://github.com/${REPO}/actions`);
  console.log(`📋 Release: https://github.com/${REPO}/releases/tag/${tag}\n`);
}

main().catch(console.error);
