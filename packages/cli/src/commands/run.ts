import { loadService, executeService, runPreflight, createReport, formatReportAsText, getImageName, buildServiceImage, parseAuditFromOutput, formatSecurityAudit, DEFAULT_POLICY, isValidRuntime } from '@ignite/core';
import { logger, ConfigError } from '@ignite/shared';

interface RunOptions {
  input?: string;
  skipPreflight?: boolean;
  json?: boolean;
  audit?: boolean;
  runtime?: string;
}

export async function runCommand(servicePath: string, options: RunOptions): Promise<void> {
  try {
    const service = await loadService(servicePath);
    
    if (options.runtime) {
      if (!isValidRuntime(options.runtime)) {
        throw new ConfigError(`Invalid runtime: ${options.runtime}`);
      }
      service.config.service.runtime = options.runtime;
      logger.info(`Runtime override: ${options.runtime}`);
    }
    
    const serviceName = service.config.service.name;
    const imageName = getImageName(serviceName);

    logger.info(`Running service: ${serviceName}`);

    let input: unknown;
    if (options.input) {
      try {
        input = JSON.parse(options.input);
      } catch {
        throw new ConfigError(`Invalid JSON input: ${options.input}`);
      }
    }

    logger.info(`Building image for ${serviceName}...`);
    await buildServiceImage(service, imageName);

    let preflightResult = await runPreflight(service, { imageName });

    if (!options.skipPreflight && preflightResult.overallStatus === 'fail') {
      logger.failure('Preflight checks failed. Use --skip-preflight to force execution.');
      process.exit(1);
    }

    const metrics = await executeService(service, { input, skipBuild: true, audit: options.audit });

    const report = createReport(preflightResult, metrics);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReportAsText(report));
    }

    if (options.audit) {
      const audit = parseAuditFromOutput(metrics.stdout, metrics.stderr, DEFAULT_POLICY);
      console.log(formatSecurityAudit(audit));
    }

    if (metrics.exitCode !== 0 && metrics.exitCode !== 124) {
      process.exit(metrics.exitCode);
    }
  } catch (err) {
    logger.error(`Execution failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
