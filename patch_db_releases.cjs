const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

if (!code.includes('ClinicKnowledgeRelease')) {
  // 1. Add import
  code = code.replace(
    'ClinicAiTool,\n} from \'../src/types\';',
    'ClinicAiTool,\n  ClinicKnowledgeRelease,\n} from \'../src/types\';'
  );

  // 2. Add to DatabaseSchema
  code = code.replace(
    'clinic_knowledge_base?: ClinicKnowledgeItem[];\n}',
    'clinic_knowledge_base?: ClinicKnowledgeItem[];\n  clinic_knowledge_releases?: ClinicKnowledgeRelease[];\n}'
  );

  // 3. Add to constructor initialization
  code = code.replace(
    'this.data.clinic_knowledge_base = fallbackData.clinic_knowledge_base || [];',
    'this.data.clinic_knowledge_base = fallbackData.clinic_knowledge_base || [];\n    this.data.clinic_knowledge_releases = fallbackData.clinic_knowledge_releases || [];'
  );

  // 4. Add methods
  const methods = `
  public getKnowledgeReleases(clinic_id: string): ClinicKnowledgeRelease[] {
    return (this.data.clinic_knowledge_releases || []).filter(r => r.clinic_id === clinic_id);
  }

  public getLatestKnowledgeRelease(clinic_id: string): ClinicKnowledgeRelease | null {
    const releases = this.getKnowledgeReleases(clinic_id);
    if (releases.length === 0) return null;
    return releases.sort((a, b) => b.version - a.version)[0];
  }

  public insertKnowledgeRelease(release: ClinicKnowledgeRelease): void {
    if (!this.data.clinic_knowledge_releases) {
      this.data.clinic_knowledge_releases = [];
    }
    this.data.clinic_knowledge_releases.push(release);
    this.saveData();
  }

  public updateKnowledgeReleaseStatus(id: string, clinic_id: string, status: 'COMPILED' | 'PUBLISHED' | 'PUBLISH_FAILED'): boolean {
    if (!this.data.clinic_knowledge_releases) return false;
    const release = this.data.clinic_knowledge_releases.find(r => r.id === id && r.clinic_id === clinic_id);
    if (release) {
      release.status = status;
      if (status === 'PUBLISHED') {
        release.published_at = new Date().toISOString();
      }
      this.saveData();
      return true;
    }
    return false;
  }
`;
  code = code.replace(
    'public getClinics()',
    methods + '\n  public getClinics()'
  );

  fs.writeFileSync('server/db.ts', code);
  console.log("DB patched with ClinicKnowledgeRelease");
} else {
  console.log("Already patched.");
}
