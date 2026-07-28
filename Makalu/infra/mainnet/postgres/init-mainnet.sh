#!/bin/sh
set -eu

# The canonical schema file also contains Makalu-only genesis accounts and
# LEP100 test contracts. Stop before that section so a new mainnet database is
# schema-only and every account/contract is learned from chain data.
sed '/^-- GENESIS ACCOUNTS/,$d' /schema/init.sql \
  | psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "Lithoscan mainnet schema initialized without Makalu seed data"
