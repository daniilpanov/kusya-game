# Test Structure

## Overview
The project uses a modular test structure to verify functionality:

### Test Files
- **js/lib/act/act-parser.test.js** — Core ActParser unit tests (syntax, parsing, group management)
- **js/lib/expressions/expressions.test.js** — Expressions library unit tests (arithmetic, comparisons, logical operators)
- **js/tests/integration.test.js** — Integration tests (parsing + expression evaluation)

### Running Tests
Use the provided script to run all tests in one command:

```bash
./run-tests.sh
```

Individual test files can also be run directly:
- `node js/lib/act/act-parser.test.js`
- `node js/lib/expressions/expressions.test.js`
- `node js/tests/integration.test.js`

## Test Coverage

### ActParser
- Basic action parsing (setBackground, goto, etc.)
- Complex expressions in if conditions (arithmetic, logical, comparison)
- Parentheses and operator precedence in conditions
- Nested paren matching
- Comments and whitespace handling

### Expressions
- All arithmetic operators (+, -, *, /, **, ^)
- Comparison operators (==, !=, <, >, <=, >=)
- Logical operators (&&, ||, !)
- Unary operators (-, !)
- Expression evaluation with variable lookup
- Operator precedence and parentheses
- Edge cases (falsy values: 0, false, null, '')

### Integration
- ACT parser + ExpressionsParser combination
- Full round-trip: ACT parsing → expression evaluation
- setVar, addStats, if with expression evaluation
- Complex condition evaluation

## Testing New Features
When adding support for new ACT handlers or expression operators:

1. Update the expression parser (`js/lib/expressions/expressions.js`)
2. Update the ACT parser if needed (`js/lib/act/act-parser.js`)
3. Add comprehensive tests in the appropriate test file
4. Run `./run-tests.sh` to verify everything still works

## Contribution Guidelines
- Maintain test readability with descriptive comments
- Cover edge cases (empty strings, falsy values, invalid syntax)
- Use real-world examples where possible (from the demo scenes)
- Ensure tests are comprehensive yet not redundant