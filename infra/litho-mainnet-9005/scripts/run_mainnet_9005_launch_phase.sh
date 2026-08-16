#!/usr/bin/env bash
set -euo pipefail

phase="${1:-}"
key=/tmp/litho-mainnet-launch-key
cleanup() {
  rm -f -- "${key}"
}
trap cleanup EXIT

umask 077
install -m 600 /mnt/c/Users/Bachal/.ssh/litho-validator "${key}"
cd /mnt/d/Playground/litho-validator-infra/ansible
export ANSIBLE_ROLES_PATH="${PWD}/roles"

case "${phase}" in
  preflight)
    ansible-playbook \
      -i inventory/mainnet-9005/hosts.ini \
      playbooks/mainnet-9005-preflight.yml \
      --private-key "${key}"
    ;;
  retire-obsolete)
    ansible-playbook \
      -i inventory/mainnet-9005/hosts.ini \
      playbooks/mainnet-9005-retire-obsolete-sentries.yml \
      --private-key "${key}"
    ;;
  wireguard)
    ansible-playbook \
      -i inventory/mainnet-9005/hosts.ini \
      playbooks/site.yml \
      --tags wireguard \
      --private-key "${key}"
    ;;
  start)
    ansible-playbook \
      -i inventory/mainnet-9005/hosts.ini \
      playbooks/mainnet-9005-deploy-and-start.yml \
      --private-key "${key}"
    ;;
  *)
    echo "usage: $0 {preflight|retire-obsolete|wireguard|start}" >&2
    exit 2
    ;;
esac
