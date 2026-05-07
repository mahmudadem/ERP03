"use strict";
/**
 * AiSkillRegistry - Central registry for AI Assistant skills/templates
 *
 * Skills are playbooks/templates that define how the AI Assistant should
 * behave in different domains. They are NOT executable code — they are
 * structured metadata that guides the AI's behavior, tool selection,
 * and safety constraints.
 *
 * DESIGN PRINCIPLES:
 * 1. Skills are templates, not code execution — no runtime side effects
 * 2. Skills never bypass permissions — they only guide behavior
 * 3. Skills never contain secrets — they reference tools by name
 * 4. Domain skills are deterministic — selected from message/module hints
 * 5. The base orchestration skill is always active
 * 6. Skills can be listed for introspection/debugging
 *
 * This registry works alongside (not replacing) the existing AiToolRegistry
 * and AiToolCallingOrchestrator. The skill system provides behavioral guidance,
 * while the tool system provides data access.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiSkillRegistry = void 0;
const base_orchestration_skill_1 = require("./base-orchestration.skill");
const domain_skills_config_1 = require("./domain-skills.config");
class AiSkillRegistry {
    constructor() {
        this.skills = new Map();
        // Base orchestration skill is always registered
        this.register(base_orchestration_skill_1.baseOrchestrationSkill);
        // Register all domain skills
        for (const skill of Object.values(domain_skills_config_1.DOMAIN_SKILLS)) {
            this.register(skill);
        }
    }
    /**
     * Register a skill. Throws if a skill with the same ID is already registered.
     */
    register(skill) {
        if (this.skills.has(skill.id)) {
            throw new Error(`AI skill '${skill.id}' is already registered`);
        }
        this.skills.set(skill.id, skill);
    }
    /**
     * Get a skill by ID. Returns undefined if not found.
     */
    get(id) {
        return this.skills.get(id);
    }
    /**
     * Get the base orchestration skill (always available).
     */
    getBaseSkill() {
        return this.skills.get('base-orchestration');
    }
    /**
     * List all registered skills.
     */
    listAll() {
        return Array.from(this.skills.values());
    }
    /**
     * List only domain skills (excludes the base orchestration skill).
     */
    listDomainSkills() {
        return this.listAll().filter(s => s.id !== 'base-orchestration');
    }
    /**
     * Select domain skills that are relevant to a user message and/or module hints.
     *
     * Selection is deterministic — based on keyword matching in the message
     * and explicit module hints. No AI model is used for skill selection.
     *
     * @param message - The user's message
     * @param moduleHints - Optional module hints from context (e.g., ['accounting', 'sales'])
     * @returns Array of matching domain skills (may be empty)
     */
    selectDomainSkills(message, moduleHints) {
        const lowerMessage = message.toLowerCase();
        const matches = [];
        for (const skill of this.listDomainSkills()) {
            // Check module hints first (explicit context)
            if (moduleHints && moduleHints.length > 0) {
                const moduleMatch = moduleHints.some(hint => skill.moduleId === hint.toLowerCase());
                if (moduleMatch) {
                    matches.push(skill);
                    continue;
                }
            }
            // Check keywords in the user message
            if (skill.triggerKeywords && skill.triggerKeywords.length > 0) {
                const keywordMatch = skill.triggerKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
                if (keywordMatch) {
                    matches.push(skill);
                }
            }
        }
        return matches;
    }
    /**
     * Get the system prompt additions from the base skill + any matching domain skills.
     * This should be injected into the AI provider conversation to guide behavior.
     */
    buildSkillContext(message, moduleHints) {
        const baseSkill = this.getBaseSkill();
        const domainSkills = this.selectDomainSkills(message, moduleHints);
        const sections = [];
        // Always include base orchestration rules
        sections.push(baseSkill.systemPrompt);
        // Add domain-specific behavior rules for matching skills
        for (const skill of domainSkills) {
            sections.push(`\n## ${skill.name}\n` +
                `${skill.systemPrompt}\n` +
                (skill.applicableTools.length > 0
                    ? `Applicable tools: ${skill.applicableTools.join(', ')}\n`
                    : ''));
        }
        return sections.join('\n');
    }
}
exports.AiSkillRegistry = AiSkillRegistry;
//# sourceMappingURL=AiSkillRegistry.js.map