#!/usr/bin/env bash
set -e

echo "Cloning Lithosphere repository..."
git clone https://github.com/KaJLabs/lithosphere.git
cd lithosphere
git checkout main

echo "Building lithod..."
make install

BIN=$(go env GOPATH)/bin/lithod
cp $BIN ../lithod

echo "lithod binary built successfully."
