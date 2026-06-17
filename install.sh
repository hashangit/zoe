#!/bin/bash
echo "Installing Zoe Agent dependencies..."
pnpm install

echo "Building Zoe Agent..."
pnpm run build

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "To configure, run:"
echo "  pnpm start -- setup"
echo ""
echo "To use, run:"
echo "  pnpm start"
echo ""
