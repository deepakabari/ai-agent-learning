import { execSync } from 'child_process';

export async function preToolUse(event) {
  const { toolName, input } = event;

  if (toolName === 'bash' &&
      input?.command?.includes('git commit')) {
    execSync('npm test -- --bail',
      { stdio: 'inherit' }); // fails fast
  }
}