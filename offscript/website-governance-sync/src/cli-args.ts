/** Pure argv parsing for the sync CLI — no fs, no process, fully unit-testable. */
export interface CliDefaults {
  readonly sourceRoot: string;
  readonly targetRoot: string;
}

export interface CliArgs {
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly dryRun: boolean;
  readonly validate: boolean;
  readonly report: boolean;
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function parseCliArgs(argv: readonly string[], defaults: CliDefaults): CliArgs {
  return {
    sourceRoot: flagValue(argv, 'source') ?? defaults.sourceRoot,
    targetRoot: flagValue(argv, 'target') ?? defaults.targetRoot,
    dryRun: argv.includes('--dry-run'),
    validate: argv.includes('--validate'),
    report: argv.includes('--report'),
  };
}
