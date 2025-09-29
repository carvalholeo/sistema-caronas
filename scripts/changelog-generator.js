#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CHANGELOG_TEMPLATE = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 

### Changed
- 

### Deprecated
- 

### Removed
- 

### Fixed
- 

### Security
- 

`;

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  return pkg.version;
}

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function readChangelog() {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");

  if (!fs.existsSync(changelogPath)) {
    console.log("📋 Creating new CHANGELOG.md...");
    fs.writeFileSync(changelogPath, CHANGELOG_TEMPLATE);
    return CHANGELOG_TEMPLATE;
  }

  return fs.readFileSync(changelogPath, "utf8");
}

function writeChangelog(content) {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  fs.writeFileSync(changelogPath, content);
}

function hasVersionEntry(content, version) {
  return content.includes(`## [${version}]`);
}

function addVersionEntry(content, version, date = null) {
  const releaseDate = date || getCurrentDate();

  // Template para nova versão
  const versionEntry = `
## [${version}] - ${releaseDate}

### Added
- 

### Changed
- 

### Deprecated
- 

### Removed
- 

### Fixed
- 

### Security
- 

`;

  // Encontrar posição do [Unreleased] e adicionar após
  const unreleasedIndex = content.indexOf("## [Unreleased]");

  if (unreleasedIndex === -1) {
    throw new Error("Could not find [Unreleased] section in CHANGELOG.md");
  }

  // Encontrar final da seção Unreleased
  const nextVersionIndex = content.indexOf("\n## [", unreleasedIndex + 1);

  if (nextVersionIndex === -1) {
    // Não há versões anteriores, adicionar no final
    return content + versionEntry;
  } else {
    // Inserir entre Unreleased e próxima versão
    const before = content.substring(0, nextVersionIndex);
    const after = content.substring(nextVersionIndex);
    return before + versionEntry + after;
  }
}

function validateVersionEntry(content, version) {
  const versionRegex = new RegExp(
    `## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\] - \\d{4}-\\d{2}-\\d{2}`,
  );

  if (!versionRegex.test(content)) {
    return {
      valid: false,
      error: `Version ${version} entry not found or invalid date format`,
    };
  }

  // Extrair seção da versão
  const startMatch = content.match(
    new RegExp(`## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\].*`),
  );
  if (!startMatch) {
    return {
      valid: false,
      error: `Could not find version ${version} section`,
    };
  }

  const startIndex = content.indexOf(startMatch[0]);
  const nextVersionMatch = content.match(/\n## \[.*?\]/g);

  let versionContent;
  if (nextVersionMatch && nextVersionMatch.length > 0) {
    const nextVersionIndex = content.indexOf(
      nextVersionMatch.find((match) => content.indexOf(match) > startIndex) ||
        "",
    );

    versionContent =
      nextVersionIndex > 0
        ? content.substring(startIndex, nextVersionIndex)
        : content.substring(startIndex);
  } else {
    versionContent = content.substring(startIndex);
  }

  // Verificar se tem pelo menos uma categoria com conteúdo
  const categories = [
    "Added",
    "Changed",
    "Deprecated",
    "Removed",
    "Fixed",
    "Security",
  ];
  let hasContent = false;

  for (const category of categories) {
    const categoryRegex = new RegExp(
      `### ${category}\\s*\\n([\\s\\S]*?)(?=\\n### |$)`,
    );
    const match = versionContent.match(categoryRegex);

    if (match && match[1].trim() && match[1].trim() !== "-") {
      hasContent = true;
      break;
    }
  }

  return {
    valid: hasContent,
    error: hasContent
      ? null
      : `Version ${version} has no content in any category`,
  };
}

function getCommitsSince(version) {
  try {
    // Tentar pegar commits desde a última tag
    const commits = execSync(
      `git log v${version}..HEAD --oneline --no-merges`,
      {
        encoding: "utf8",
      },
    ).trim();

    return commits ? commits.split("\n") : [];
  } catch (error) {
    // Se não há tag anterior, pegar últimos commits
    try {
      const commits = execSync("git log --oneline --no-merges -10", {
        encoding: "utf8",
      }).trim();

      return commits ? commits.split("\n") : [];
    } catch (fallbackError) {
      return [];
    }
  }
}

function generateChangelogFromCommits(version) {
  const commits = getCommitsSince(version);
  const date = getCurrentDate();

  const categories = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: [],
    Security: [],
    Deprecated: [],
  };

  commits.forEach((commit) => {
    const message = commit.replace(/^[a-f0-9]+ /, "");

    if (message.startsWith("feat")) {
      categories.Added.push(`- ${message.replace(/^feat[:(].*?[)]?\s*/, "")}`);
    } else if (message.startsWith("fix")) {
      categories.Fixed.push(`- ${message.replace(/^fix[:(].*?[)]?\s*/, "")}`);
    } else if (message.startsWith("chore")) {
      categories.Changed.push(
        `- ${message.replace(/^chore[:(].*?[)]?\s*/, "")}`,
      );
    } else if (message.startsWith("refactor")) {
      categories.Changed.push(
        `- ${message.replace(/^refactor[:(].*?[)]?\s*/, "")}`,
      );
    } else if (message.startsWith("perf")) {
      categories.Changed.push(
        `- ${message.replace(/^perf[:(].*?[)]?\s*/, "")}`,
      );
    } else if (message.startsWith("security")) {
      categories.Security.push(
        `- ${message.replace(/^security[:(].*?[)]?\s*/, "")}`,
      );
    } else {
      categories.Changed.push(`- ${message}`);
    }
  });

  let versionEntry = `\n## [${version}] - ${date}\n\n`;

  Object.entries(categories).forEach(([category, items]) => {
    versionEntry += `### ${category}\n`;
    if (items.length > 0) {
      versionEntry += items.join("\n") + "\n";
    } else {
      versionEntry += "- \n";
    }
    versionEntry += "\n";
  });

  return versionEntry;
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      console.log("📋 Initializing CHANGELOG.md...");
      if (fs.existsSync("CHANGELOG.md")) {
        console.log("CHANGELOG.md already exists");
      } else {
        writeChangelog(CHANGELOG_TEMPLATE);
        console.log("✅ CHANGELOG.md created");
      }
      break;

    case "add":
      const version = args[1] || getCurrentVersion();
      console.log(`📝 Adding version ${version} to CHANGELOG...`);

      let content = readChangelog();

      if (hasVersionEntry(content, version)) {
        console.log(`Version ${version} already exists in CHANGELOG`);
        process.exit(0);
      }

      if (args.includes("--auto")) {
        // Gerar automaticamente dos commits
        const autoEntry = generateChangelogFromCommits(version);
        const unreleasedIndex = content.indexOf("## [Unreleased]");
        const nextVersionIndex = content.indexOf("\n## [", unreleasedIndex + 1);

        if (nextVersionIndex === -1) {
          content += autoEntry;
        } else {
          const before = content.substring(0, nextVersionIndex);
          const after = content.substring(nextVersionIndex);
          content = before + autoEntry + after;
        }
      } else {
        // Adicionar template vazio
        content = addVersionEntry(content, version);
      }

      writeChangelog(content);
      console.log(`✅ Version ${version} added to CHANGELOG`);
      break;

    case "validate":
      const validateVersion = args[1] || getCurrentVersion();
      console.log(`🔍 Validating CHANGELOG for version ${validateVersion}...`);

      const changelogContent = readChangelog();
      const validation = validateVersionEntry(
        changelogContent,
        validateVersion,
      );

      if (validation.valid) {
        console.log(
          `✅ CHANGELOG validation passed for version ${validateVersion}`,
        );
      } else {
        console.error(`❌ CHANGELOG validation failed: ${validation.error}`);
        process.exit(1);
      }
      break;

    default:
      console.log("Usage:");
      console.log(
        "  npm run changelog:init              # Create CHANGELOG.md",
      );
      console.log("  npm run changelog:add [version]     # Add version entry");
      console.log(
        "  npm run changelog:add --auto        # Auto-generate from commits",
      );
      console.log(
        "  npm run changelog:validate [version] # Validate version entry",
      );
      process.exit(1);
  }
}

main();
