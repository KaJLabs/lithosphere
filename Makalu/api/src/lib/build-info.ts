/**
 * Build metadata helpers. Reads GIT_SHA / BUILD_TIME / VERSION from the env
 * (injected by CI in publish-images.yaml / deploy-simple.yaml via Dockerfile
 * ARGs) and exposes them as a `/version` payload + a Prometheus build_info
 * gauge.
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
