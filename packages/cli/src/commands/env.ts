import { loadService, checkEnvironmentDrift, formatEnvironmentInfo, getSupportedRuntimes, getSupportedVersions, getRuntimePlugin } from '@ignite/core';
import { logger } from '@ignite/shared';

interface EnvOptions {
  runtimes?: boolean;
}

export async function envCommand(servicePath: string | undefined, options: EnvOptions): Promise<void> {
  try {
    if (options.runtimes) {
      listRuntimes();
      return;
    }

    if (!servicePath) {
      logger.error('Service path required. Use `ignite env <service>` or `ignite env --runtimes`');
      process.exit(1);
    }

    const service = await loadService(servicePath);
    const serviceName = service.config.service.name;
    const runtime = service.config.service.runtime;

    logger.info(`Environment info for ${serviceName}`);
    console.log('');
    
    console.log(`Service: ${serviceName}`);
    console.log(`Runtime: ${runtime}`);
    console.log('');

    const info = await checkEnvironmentDrift(service.servicePath, runtime);
    console.log(formatEnvironmentInfo(info));
    
  } catch (err) {
    logger.error(`Failed to get environment info: ${(err as Error).message}`);
    process.exit(1);
  }
}

function listRuntimes(): void {
  console.log('Supported Runtimes:\n');
  
  const runtimes = getSupportedRuntimes();
  
  for (const name of runtimes) {
    const plugin = getRuntimePlugin(name);
    if (!plugin) continue;
    
    const versions = getSupportedVersions(name);
    const defaultVersion = plugin.defaultVersion ?? 'latest';
    
    console.log(`  ${name}`);
    console.log(`    Default entry: ${plugin.defaultEntry}`);
    console.log(`    Extensions: ${plugin.fileExtensions.join(', ')}`);
    
    if (versions.length > 0) {
      console.log(`    Versions: ${versions.join(', ')} (default: ${defaultVersion})`);
    }
    
    console.log('');
  }
  
  console.log('Usage examples:');
  console.log('  service.yaml: runtime: bun');
  console.log('  service.yaml: runtime: bun@1.2');
  console.log('  service.yaml: runtime: node@20');
  console.log('  ignite run . --runtime node@22');
}
