#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}=== Running Kusya Game Tests ===${NC}"
echo -e "${YELLOW}Running ActParser tests...${NC}"

# Run ActParser tests
echo "Running js/lib/act/act-parser.test.js..."
node js/lib/act/act-parser.test.js
echo -e "${GREEN}✓ ActParser tests passed!${NC}"

echo -e "${YELLOW}Running expressions tests...${NC}"
echo "Running js/lib/expressions/expressions.test.js..."
node js/lib/expressions/expressions.test.js
echo -e "${GREEN}✓ expressions tests passed!${NC}"

echo -e "${YELLOW}Running integration tests...${NC}"
echo "Running js/tests/integration.test.js..."
node js/tests/integration.test.js
echo -e "${GREEN}✓ integration tests passed!${NC}"

echo -e "${YELLOW}Running runtime error tests...${NC}"
echo "Running js/tests/runtime-errors.test.js..."
node js/tests/runtime-errors.test.js
echo -e "${GREEN}✓ runtime error tests passed!${NC}"

echo -e "${GREEN}=== All tests passed! ===${NC}"