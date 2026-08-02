#!/usr/bin/env bash
set -euo pipefail

key=/tmp/litho-mainnet-stage-key
cleanup() {
  rm -f -- "${key}"
}
trap cleanup EXIT

umask 077
install -m 600 /mnt/c/Users/Bachal/.ssh/litho-validator "${key}"
cd /mnt/d/Playground/litho-validator-infra/ansible
ansible-playbook \
  -i inventory/mainnet-9005/hosts.ini \
  playbooks/mainnet-9005-stage-genesis.yml \
  --private-key "${key}"
