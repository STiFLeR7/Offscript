import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { root, runNode } from './workspace.mjs';

// Explicitly exercise the manual-brief compatibility path, without fabricating
// ProjectReadiness or approvals. The full native project path is documented separately.
try {
  const runner = join(root, 'offscript/node_modules/tsx/dist/cli.mjs');
  if (!existsSync(runner)) throw new Error('Run npm run setup first.');
  const project = join(root, 'offscript/projects/offscript-demo');
  const marker = join(project, '.offscript-demo');
  if (existsSync(project) && !existsSync(marker)) {
    throw new Error('The offscript-demo workspace already contains user work. Choose another project; the demo will not overwrite it.');
  }
  if (existsSync(join(project, 'readiness.json')) || existsSync(join(project, 'project.json'))) {
    throw new Error('The demo workspace has become a native project. Use another project for native operations.');
  }
  mkdirSync(join(project, 'references'), { recursive: true });
  writeFileSync(marker, 'Managed synthetic demo workspace.\n');
  cpSync(join(root, 'examples/offscript-demo/brief.md'), join(project, 'references/brief.md'));
  const output = join(project, 'website');
  mkdirSync(output, { recursive: true });
  // This managed smoke example always starts from an empty selection history.
  // Normal projects retain cross-page variety; the demo needs a stable baseline.
  writeFileSync(join(output, 'section-usage.json'), '{}\n');

  // Session opt-in flags must not silently turn a deterministic demonstration into
  // a model-authoring / browser run. Regular offscript commands preserve operator settings.
  const demoEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OFFSCRIPT_') && key !== 'V2_ASSET_SOURCE'));
  demoEnv.OFFSCRIPT_AUTHOR = 'scripted';
  console.log('Offscript demo: deterministic assembly + static reports. No model calls or browser checks.');
  runNode([runner, join(root, 'offscript/scripts/generate.ts'), 'offscript-demo', '--track', 'website'], { env: demoEnv });

  const htmlFiles = readdirSync(output).filter(name => name.endsWith('.html'));
  if (!htmlFiles.length) throw new Error('Generation exited without producing an HTML deliverable.');
  for (const name of ['score.json', 'rendering-ir.json']) {
    if (!existsSync(join(output, name))) throw new Error(`Generation did not produce ${name}.`);
    JSON.parse(readFileSync(join(output, name), 'utf8'));
  }
  const review = JSON.parse(readFileSync(join(output, 'review-package.json'), 'utf8'));
  const doctor = JSON.parse(readFileSync(join(output, 'doctor-report.json'), 'utf8'));
  const latestHtml = htmlFiles.sort((a, b) => statSync(join(output, b)).mtimeMs - statSync(join(output, a)).mtimeMs)[0];
  const artifacts = [latestHtml].map(name => ({
    file: `offscript/projects/offscript-demo/website/${name}`,
    sha256: createHash('sha256').update(readFileSync(join(output, name))).digest('hex'),
  }));
  const summary = {
    mode: 'scripted-manual-brief-compatibility',
    visualAcceptance: 'not-performed',
    browserGeometry: 'not-validated',
    doctorStatus: doctor.headlineStatus,
    reviewStatus: review.headlineStatus,
    findings: doctor.findingCount,
    warnings: doctor.findings.filter(finding => finding.severity === 'advisory').length,
    artifacts,
    reportsDirectory: 'offscript/projects/offscript-demo/website',
  };
  writeFileSync(join(project, 'demo-result.json'), JSON.stringify(summary, null, 2) + '\n');
  // The engine completes with exit 0 even for a FAILED headline.
  // Read its report explicitly so this wrapper cannot present that as a passing demo.
  if (doctor.headlineStatus === 'failed' || review.headlineStatus === 'failed') {
    throw new Error('The generated draft has a FAILED headline. Read the doctor/review reports.');
  }
  console.log(`\nDemo output: ${output}\nScripted draft only. Read score/doctor/review reports before using it.`);
} catch (error) {
  console.error(`[Offscript demo] ${error.message}`);
  process.exitCode = 1;
}
