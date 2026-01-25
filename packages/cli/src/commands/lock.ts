import { loadService, lockEnvironment, checkEnvironmentDrift, formatEnvironmentInfo } from '@ignite/core';
import { logger } from '@ignite/shared';

interface LockOptions {
  update?: boolean;
  check?: boolean;
}

export async function lockCommand(servicePath: string, options: LockOptions): Promise<void> {
  try {
    const service = await loadService(servicePath);
    const serviceName = service.config.service.name;
    const runtime = service.config.service.runtime;

    if (options.check) {
      logger.info(`Checking environment for ${serviceName}...`);
      const info = await checkEnvironmentDrift(service.servicePath, runtime);
      console.log(formatEnvironmentInfo(info));
      
      if (info.isDrift) {
        process.exit(1);
      }
      return;
    }

    const existingInfo = await checkEnvironmentDrift(service.servicePath, runtime);
    
    if (existingInfo.isLocked && !options.update) {
      logger.warn('Environment already locked. Use --update to refresh the manifest.');
      console.log(formatEnvironmentInfo(existingInfo));
      return;
    }

    logger.info(`Locking environment for ${serviceName}...`);
    const manifest = await lockEnvironment(service.servicePath, runtime);
    
    logger.success(`Created ignite.lock for ${serviceName}`);
    console.log(`  Runtime: ${manifest.runtime.name}@${manifest.runtime.version}`);
    console.log(`  Lockfile: ${manifest.lockfile ?? 'none detected'}`);
    console.log(`  Checksums: ${Object.keys(manifest.checksums).length} file(s)`);
    
  } catch (err) {
    logger.error(`Lock failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
