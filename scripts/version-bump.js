#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const VALID_INCREMENTS = ["major", "minor", "patch"];
const VALID_SUFFIXES = ["rc", "beta", "alpha", "dev", "feature"];

function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    console.error("Error getting current branch:", error.message);
    process.exit(1);
  }
}

function getCurrentVersion() {
  const packagePath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return pkg.version;
}

function updateVersion(newVersion) {
  const packagePath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  pkg.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    suffix: match[4] || null,
    suffixNumber: match[5] ? parseInt(match[5]) : null,
  };
}

function incrementVersion(version, increment, suffix = null) {
  const parsed = parseVersion(version);

  if (suffix) {
    // Para branches não-semânticas
    if (!VALID_SUFFIXES.includes(suffix)) {
      throw new Error(
        `Invalid suffix. Use one of: ${VALID_SUFFIXES.join(", ")}`,
      );
    }

    if (parsed.suffix === suffix) {
      // Incrementar número do sufixo
      parsed.suffixNumber = (parsed.suffixNumber || 0) + 1;
    } else {
      // Novo sufixo
      parsed.suffixNumber = 1;
      parsed.suffix = suffix;
    }

    return `${parsed.major}.${parsed.minor}.${parsed.patch}-${parsed.suffix}.${parsed.suffixNumber}`;
  } else {
    // Para branches semânticas (main/develop)
    if (parsed.suffix) {
      // Remover sufixo e manter versão base
      return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }

    switch (increment) {
      case "major":
        return `${parsed.major + 1}.0.0`;
      case "minor":
        return `${parsed.major}.${parsed.minor + 1}.0`;
      case "patch":
        return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
      default:
        throw new Error(
          `Invalid increment. Use one of: ${VALID_INCREMENTS.join(", ")}`,
        );
    }
  }
}

// ... código anterior ...

function main() {
  const args = process.argv.slice(2);
  const currentBranch = getCurrentBranch();
  const currentVersion = getCurrentVersion();

  console.log(`Current branch: ${currentBranch}`);
  console.log(`Current version: ${currentVersion}`);

  if (args.length === 0) {
    console.log("\nUsage:");
    console.log("  For semantic branches (main/develop):");
    console.log("    npm run version:bump major|minor|patch [--changelog]");
    console.log("  For feature branches:");
    console.log("    npm run version:bump suffix rc|beta|alpha|dev|feature");
    process.exit(1);
  }

  const isSemanticBranch = ["main", "develop"].includes(currentBranch);

  try {
    let newVersion;

    if (isSemanticBranch) {
      // Branch semântica
      if (args[0] === "suffix") {
        throw new Error(
          `Cannot use suffix versions in semantic branch: ${currentBranch}`,
        );
      }

      if (!VALID_INCREMENTS.includes(args[0])) {
        throw new Error(
          `Invalid increment for semantic branch. Use: ${VALID_INCREMENTS.join(", ")}`,
        );
      }

      newVersion = incrementVersion(currentVersion, args[0]);

      // 🆕 Atualizar CHANGELOG para versões semânticas
      if (args.includes("--changelog")) {
        console.log("📋 Updating CHANGELOG...");
        execSync(
          `node scripts/changelog-generator.js add ${newVersion} --auto`,
        );
      }
    } else {
      // Branch não-semântica (sem CHANGELOG)
      if (args[0] === "suffix") {
        const suffix = args[1];
        if (!suffix) {
          throw new Error("Suffix name required");
        }
        newVersion = incrementVersion(currentVersion, null, suffix);
      } else if (VALID_INCREMENTS.includes(args[0])) {
        throw new Error(
          `Cannot use semantic increments in feature branch: ${currentBranch}. Use: npm run version:bump suffix <name>`,
        );
      } else {
        throw new Error(
          "Invalid command for feature branch. Use: npm run version:bump suffix <name>",
        );
      }
    }

    updateVersion(newVersion);
    console.log(`✅ Version updated: ${currentVersion} → ${newVersion}`);

    // Auto-commit
    if (args.includes("--commit")) {
      execSync(`git add package.json`);
      if (isSemanticBranch && args.includes("--changelog")) {
        execSync(`git add CHANGELOG.md`);
        execSync(
          `git commit -m "chore: bump version to ${newVersion} and update changelog"`,
        );
      } else {
        execSync(`git commit -m "chore: bump version to ${newVersion}"`);
      }
      console.log("✅ Changes committed");
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
