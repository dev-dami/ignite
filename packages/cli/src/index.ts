#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { preflightCommand } from './commands/preflight.js';
import { reportCommand } from './commands/report.js';
import { serveCommand } from './commands/serve.js';

const program = new Command();

program
  .name('ignite')
  .description('A local execution framework for JavaScript microservices with pre-execution safety analysis')
  .version('0.1.0');

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
  .option('--skip-preflight', 'Skip preflight checks before execution')
  .option('--json', 'Output results as JSON')
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

program.parse();
