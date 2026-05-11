/**
 * Build metadata helpers — mirrors @lithosphere/api's build-info module.
 * Kept duplicated rather than cross-package imported because api and indexer
 * are independently published Docker services with no shared workspace deps.
 */

export interface BuildInfo {
  gitSha: string;
  buildTime: string;
  version: string;
  nodeVersion: string;
}

export function readBuildInfo(env: NodeJS.ProcessEnv = process.env): BuildInfo {
  return {
    gitSha: env.GIT_SHA || 'unknown',
    buildTime: env.BUILD_TIME || 'unknown',
    version: env.VERSION || env.npm_package_version || '0.0.0',
    nodeVersion: process.version,
  };
}

export interface VersionResponse extends BuildInfo {
  service: string;
  uptimeSec: number;
}

export function buildVersionResponse(
  service: string,
  startedAt: number,
  info: BuildInfo = readBuildInfo(),
): VersionResponse {
  return {
    service,
    ...info,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  };
}
