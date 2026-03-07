#!/bin/bash
set -uo pipefail

echo '=== 1. PROMETHEUS STATUS ==='
echo '-- Docker containers matching prometheus/grafana/node-exporter --'
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'docker not available'

echo ''
echo '-- Prometheus health --'
curl -sf --max-time 5 http://localhost:9090/-/healthy && echo ' -> port 9090 healthy' || echo ' -> port 9090 NOT responding'
curl -sf --max-time 5 http://localhost:9091/-/healthy && echo ' -> port 9091 healthy' || echo ' -> port 9091 NOT responding'

echo ''
echo '=== 2. CONNECTIVITY TO VALIDATOR/SENTRIES ==='
for pair in '10.0.10.65:26660:validator-cometbft' '10.0.10.65:9100:validator-nodeexp' '10.0.1.218:26660:sentry01-cometbft' '10.0.1.218:9100:sentry01-nodeexp' '10.1.1.227:26660:sentry02-cometbft' '10.1.1.227:9100:sentry02-nodeexp'; do
  IP=$(echo "$pair" | cut -d: -f1)
  PORT=$(echo "$pair" | cut -d: -f2)
  LABEL=$(echo "$pair" | cut -d: -f3)
  printf '  %-25s -> ' "$LABEL ($IP:$PORT)"
  timeout 3 bash -c "echo > /dev/tcp/$IP/$PORT" 2>/dev/null && echo 'REACHABLE' || echo 'BLOCKED'
done

echo ''
echo '=== 3. PROMETHEUS TARGETS ==='
TARGETS=$(curl -sf --max-time 10 http://localhost:9090/api/v1/targets 2>/dev/null || curl -sf --max-time 10 http://localhost:9091/api/v1/targets 2>/dev/null)
if [ -n "$TARGETS" ]; then
  echo "$TARGETS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for t in d.get('data',{}).get('activeTargets',[]):
  h=t.get('health','?')
  j=t.get('labels',{}).get('job','?')
  i=t.get('labels',{}).get('instance','?')
  e=t.get('lastError','')
  tag='  UP  ' if h=='up' else ' DOWN '
  print(f'  [{tag}] job={j:20s} instance={i:25s} error={e or \"none\"}')
" 2>/dev/null || echo "$TARGETS" | head -50
else
  echo '  Prometheus API not reachable'
fi

echo ''
echo '=== 4. GRAFANA HEALTH ==='
curl -sf --max-time 5 http://localhost:3001/api/health 2>/dev/null && echo '' || echo '  Grafana NOT responding on :3001'
curl -sf --max-time 5 http://localhost:3000/api/health 2>/dev/null && echo '' || echo '  Grafana NOT responding on :3000'

echo ''
echo '=== 5. DEPLOY DIRECTORY ==='
ls -la /opt/lithoscan/ 2>/dev/null | head -20 || echo '  /opt/lithoscan not found'
echo ''
echo '=== DONE ==='
