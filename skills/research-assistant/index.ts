import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Research Assistant Skill
 *
 * Loads the SKILL.md persona and provides configuration
 * for the LangGraph agent to act as a research assistant.
 */

export interface SkillConfig {
  /** Unique skill identifier. */
  id: string;
  /** Human-readable skill name. */
  name: string;
  /** The system prompt loaded from SKILL.md. */
  systemPrompt: string;
  /** MCP tools this skill requires. */
  requiredTools: string[];
  /** Whether this skill is enabled. */
  enabled: boolean;
}

/**
 * Load the Research Assistant skill configuration.
 */
export async function loadSkill(): Promise<SkillConfig> {
  const skillPath = resolve(__dirname, "SKILL.md");
  const systemPrompt = await readFile(skillPath, "utf-8");

  return {
    id: "research-assistant",
    name: "Research Assistant",
    systemPrompt,
    requiredTools: ["read_file", "list_directory"],
    enabled: true,
  };
}
