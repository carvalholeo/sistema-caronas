#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");

function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    return "unknown";
  }
}

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  return pkg.version;
}

function validateVersionFormat(version, branch) {
  const semanticRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  const nonSemanticRegex =
    /^[0-9]+\.[0-9]+\.[0-9]+-(rc|beta|alpha|dev|feature)\.[0-9]+$/;

  const isSemanticBranch = ["main", "develop"].includes(branch);
  const isSemanticVersion = semanticRegex.test(version);
  const isNonSemanticVersion = nonSemanticRegex.test(version);

  if (!isSemanticVersion && !isNonSemanticVersion) {
    console.error(`❌ Invalid version format: ${version}`);
    console.error("Must be either X.Y.Z or X.Y.Z-suffix.N");
    process.exit(1);
  }

  if (isSemanticBranch && !isSemanticVersion) {
    console.error(`❌ Branch '${branch}' requires semantic versioning (X.Y.Z)`);
    console.error(`Found: ${version}`);
    process.exit(1);
  }

  if (!isSemanticBranch && isSemanticVersion) {
    console.error(
      `❌ Feature branch '${branch}' cannot use semantic versioning`,
    );
    console.error(`Use format: X.Y.Z-suffix.N (e.g., 1.0.0-rc.1)`);
    process.exit(1);
  }

  console.log(`✅ Version format valid for branch '${branch}': ${version}`);
}

const branch = getCurrentBranch();
const version = getCurrentVersion();

validateVersionFormat(version, branch);
