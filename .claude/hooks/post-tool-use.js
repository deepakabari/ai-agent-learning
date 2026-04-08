import { execSync } from 'child_process';

export async function postToolUse(event) {
  const { toolName, output } = event;
  const path = output?.path || '';

  if (toolName === 'write_file' &&
      (path.endsWith('.js') || path.endsWith('.tsx'))) {
    try {
      execSync(`npx prettier --write ${path}`,
        { stdio: 'inherit' });
      console.log('Auto-formatted:', path);
    } catch (e) { /* skip if prettier missing */ }
  }
}