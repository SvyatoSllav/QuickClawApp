const DOMAIN_VARIABLE_MAP = {
  'Finance': {
    '{Input_Data}': '$Stock_Price_Feed',
    '{Risk_Factor}': '$Market_Volatility_Index',
    '{Goal}': 'Maximize_Alpha'
  },
  'Legal': {
    '{Input_Data}': '$Case_Evidence_Stream',
    '{Risk_Factor}': '$Liability_Exposure_Index',
    '{Goal}': 'Mitigate_Legal_Risk'
  },
  'Occult': {
    '{Input_Data}': '$Card_Symbolism',
    '{Risk_Factor}': '$Karmic_Debt_Level',
    '{Goal}': 'Reveal_Hidden_Truths'
  },
  'Coding': {
    '{Input_Data}': '$Source_Code_AST',
    '{Risk_Factor}': '$Cyclomatic_Complexity',
    '{Goal}': 'Refactor_For_Readability'
  },
  'System_Ops': {
    '{Input_Data}': '$System_Metrics_Stream',
    '{Risk_Factor}': '$Resource_Utilization_Index',
    '{Goal}': 'Optimize_Performance'
  },
  'Creative_Writing': {
    '{Input_Data}': '$Narrative_Context',
    '{Risk_Factor}': '$Plot_Coherence_Level',
    '{Goal}': 'Craft_Compelling_Story'
  },
  'Gaming': {
    '{Input_Data}': '$Game_State_Data',
    '{Risk_Factor}': '$Balance_Disruption_Index',
    '{Goal}': 'Optimize_Game_Design'
  },
  'General': {
    '{Input_Data}': '$User_Message',
    '{Risk_Factor}': '$Ambiguity_Level',
    '{Goal}': 'Helpful_Answer'
  }
};

export class SkillInjector {
  static instantiate(skill, context) {
    let template = this.selectTemplateVariant(skill, context.userLevel);

    if (!template) {
      return `### Skill: ${skill.skill_name}\n${skill.description}`;
    }

    const domainKey = DOMAIN_VARIABLE_MAP[context.domain] ? context.domain : 'General';
    const variableMap = DOMAIN_VARIABLE_MAP[domainKey];

    for (const [generic, specific] of Object.entries(variableMap)) {
      const regex = new RegExp(generic.replace(/\{/g, '\\{').replace(/\}/g, '\\}'), 'g');
      template = template.replace(regex, specific);
    }

    if (context.tone) {
      template = template.replace(/{Tone}/g, context.tone);
    }

    return `### [Skill: ${skill.skill_name}]\n${template}`;
  }

  static selectTemplateVariant(skill, userLevel) {
    if (!skill.variants || skill.variants.length === 0) {
      return skill.generalized_instruction_template || "";
    }

    if (userLevel) {
      const match = skill.variants.find(v => v.variant_name.toLowerCase().includes(userLevel.toLowerCase()));
      if (match) return match.generalized_instruction_template;
    }

    return skill.variants[0].generalized_instruction_template;
  }
}
