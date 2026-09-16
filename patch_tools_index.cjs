const fs = require('fs');
const path = 'server/voice/tools/index.ts';
let content = fs.readFileSync(path, 'utf8');

// Insert import
if (!content.includes('searchClinicKnowledge')) {
  content = content.replace(
    'import { getAvailableSlots } from \'./get-available-slots\';',
    'import { getAvailableSlots } from \'./get-available-slots\';\nimport { searchClinicKnowledge } from \'./search-knowledge\';'
  );
}

// Insert tool definition
const toolDef = `  {
    name: 'searchClinicKnowledge',
    description: 'Search the static clinic knowledge base for policies, FAQs, arrival instructions, and general operational information. Use this when the patient asks questions about clinic rules, payments, directions, or procedures.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The semantic search query based on the user\\'s question. Be descriptive.',
        },
      },
      required: ['query'],
    },
  },
`;

if (!content.includes('searchClinicKnowledge')) {
  content = content.replace('export const AI_RECEPTIONIST_TOOL_DEFINITIONS: ToolDefinition[] = [\n', 
    'export const AI_RECEPTIONIST_TOOL_DEFINITIONS: ToolDefinition[] = [\n' + toolDef);
}

// Insert export
const exportReplacement = `export {
  getClinicInfo,
  getPatientByPhone,
  createPatient,
  getClinicDoctors,
  getClinicServices,
  getAvailableSlots,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  escalateToStaff,
  searchClinicKnowledge
};`;

// Find existing export block
const exportRegex = /export\s*{\s*getClinicInfo,[\s\S]*?escalateToStaff,?\s*};/m;
content = content.replace(exportRegex, exportReplacement);

fs.writeFileSync(path, content);
