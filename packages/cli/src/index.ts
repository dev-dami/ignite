#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { preflightCommand } from './commands/preflight.js';
import { reportCommand } from './commands/report.js';
import { serveCommand } from './commands/serve.js';
import { lockCommand } from './commands/lock.js';
import { envCommand } from './commands/env.js';

const program = new Command();

program
  .name('ignite')
  .description('Secure sandbox for AI-generated code, untrusted scripts, and JS/TS execution')
  .version('0.7.2');

program
  .command('init <name>')
  .description('Initialize a new Ignite service')
  .option('-p, --path <path>', 'Custom path for the service directory')
  .option('-r, --runtime <runtime>', 'Runtime to use (node or bun)', 'bun')
  .action(initCommand);

program
  .command('run <service>')
  .description('Execute a service in an isolated container')
  .option('-i, --input <json>', 'JSON input to pass to the service')
  .option('-r, --runtime <runtime>', 'Override runtime (e.g., node@20, bun@1.2)')
  .option('--skip-preflight', 'Skip preflight checks before execution')
  .option('--json', 'Output results as JSON')
  .option('--audit', 'Run with security audit (blocks network, read-only filesystem)')
  .option('--audit-output <file>', 'Write security audit to a JSON file')
  .action(runCommand);

program
  .command('preflight <service>')
  .description('Run preflight checks without executing the service')
  .action(preflightCommand);

program
  .command('report <service>')
  .description('Generate a detailed report for a service')
  .option('-o, --output <file>', 'Save report to a file')
  .option('--json', 'Output as JSON format')
  .action(reportCommand);

program.addCommand(serveCommand);

program
  .command('lock <service>')
  .description('Create or update ignite.lock manifest for reproducible environments')
  .option('-u, --update', 'Update existing manifest')
  .option('-c, --check', 'Check for environment drift without modifying')
  .action(lockCommand);

program
  .command('env [service]')
  .description('Show environment info and available runtimes')
  .option('--runtimes', 'List all supported runtimes and versions')
  .action(envCommand);

program.parse();
