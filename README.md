# BFFLESS Compare Coverage

A GitHub Action to compare test coverage reports against a BFFLESS baseline for coverage regression detection.

## Features

- **Multiple Coverage Formats**: Supports LCOV, Istanbul, Cobertura, Clover, and JaCoCo
- **Auto-Detection**: Automatically detects coverage format from file extension or content
- **Directory Support**: Pass a directory and the action finds the coverage file automatically
- **PR Comments**: Posts coverage comparison as a PR comment
- **GitHub Summaries**: Generates step summaries with detailed metrics
- **Threshold Control**: Configure allowed regression percentage
- **File-Level Tracking**: Shows which files improved or regressed

## Usage

```yaml
- name: Compare coverage
  uses: bffless/compare-coverage@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    path: ./coverage/lcov.info
    baseline-alias: coverage-production
    api-url: ${{ vars.BFFLESS_URL }}
    api-key: ${{ secrets.BFFLESS_API_KEY }}
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `path` | **Yes** | - | Path to coverage report file or directory (auto-finds coverage file) |
| `baseline-alias` | **Yes** | - | BFFLESS alias for baseline coverage |
| `api-url` | **Yes** | - | BFFLESS API URL |
| `api-key` | **Yes** | - | BFFLESS API key |
| `format` | No | `auto` | Coverage format: `lcov`, `istanbul`, `cobertura`, `clover`, `jacoco`, or `auto` |
| `threshold` | No | `0` | Allowed regression % (0 = any regression fails) |
| `upload-results` | No | `true` | Upload current coverage to BFFLESS |
| `alias` | No | `preview` | Alias for uploaded coverage |
| `fail-on-regression` | No | `true` | Fail action if coverage regresses |
| `summary` | No | `true` | Generate GitHub step summary |
| `comment` | No | `true` | Post PR comment |
| `comment-header` | No | `## Coverage Report` | PR comment header |

### Outputs

| Output | Description |
|--------|-------------|
| `statements` | Statement coverage % |
| `branches` | Branch coverage % |
| `functions` | Function coverage % |
| `lines` | Line coverage % |
| `statements-delta` | Change vs baseline |
| `branches-delta` | Change vs baseline |
| `functions-delta` | Change vs baseline |
| `lines-delta` | Change vs baseline |
| `result` | Overall: `pass`, `fail`, `improved` |
| `report` | JSON report contents |
| `baseline-commit-sha` | Baseline commit SHA |
| `upload-url` | URL to uploaded coverage |

## Supported Coverage Formats

| Format | File Types | Used By |
|--------|------------|---------|
| **lcov** | `.info`, `.lcov` | Jest, c8, nyc, gcov, Vitest |
| **istanbul** | `coverage-final.json` | Jest, nyc, Istanbul |
| **cobertura** | `.xml` | Python (coverage.py), .NET, PHPUnit |
| **clover** | `.xml` | PHP (PHPUnit), Java |
| **jacoco** | `.xml` | Java, Kotlin, Scala |

## Path Resolution

The `path` input accepts either a file or directory:

```yaml
# Direct file path
path: ./coverage/lcov.info

# Directory - action will find the coverage file
path: ./coverage
```

When a directory is provided, the action searches for these files (in order):
- `lcov.info`, `coverage.lcov`
- `coverage-final.json`, `coverage.json`
- `cobertura.xml`, `cobertura-coverage.xml`, `coverage.xml`
- `clover.xml`
- `jacoco.xml`, `jacocoTestReport.xml`

## Examples

### Jest / Vitest (LCOV)

```yaml
- name: Run tests
  run: npm test -- --coverage

- name: Compare coverage
  uses: bffless/compare-coverage@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    path: ./coverage/lcov.info
    format: lcov
    baseline-alias: coverage-production
    api-url: ${{ vars.BFFLESS_URL }}
    api-key: ${{ secrets.BFFLESS_API_KEY }}
```

### Python (Cobertura)

```yaml
- name: Run tests
  run: |
    pytest --cov=src --cov-report=xml

- name: Compare coverage
  uses: bffless/compare-coverage@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    path: ./coverage.xml
    format: cobertura
    baseline-alias: coverage-production
    api-url: ${{ vars.BFFLESS_URL }}
    api-key: ${{ secrets.BFFLESS_API_KEY }}
```

### Java (JaCoCo)

```yaml
- name: Run tests
  run: ./gradlew test jacocoTestReport

- name: Compare coverage
  uses: bffless/compare-coverage@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    path: ./build/reports/jacoco/test/jacocoTestReport.xml
    format: jacoco
    baseline-alias: coverage-production
    api-url: ${{ vars.BFFLESS_URL }}
    api-key: ${{ secrets.BFFLESS_API_KEY }}
```

### Allow Minor Regression

```yaml
- name: Compare coverage
  uses: bffless/compare-coverage@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    path: ./coverage/lcov.info
    baseline-alias: coverage-production
    api-url: ${{ vars.BFFLESS_URL }}
    api-key: ${{ secrets.BFFLESS_API_KEY }}
    threshold: 1  # Allow up to 1% regression
```

### Use Coverage in Subsequent Steps

```yaml
- name: Compare coverage
  id: coverage
  uses: bffless/compare-coverage@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    path: ./coverage/lcov.info
    baseline-alias: coverage-production
    api-url: ${{ vars.BFFLESS_URL }}
    api-key: ${{ secrets.BFFLESS_API_KEY }}
    fail-on-regression: false  # Don't fail, handle in next step

- name: Check coverage result
  run: |
    echo "Lines: ${{ steps.coverage.outputs.lines }}%"
    echo "Delta: ${{ steps.coverage.outputs.lines-delta }}%"
    echo "Result: ${{ steps.coverage.outputs.result }}"

    if [ "${{ steps.coverage.outputs.result }}" == "fail" ]; then
      echo "::warning::Coverage regressed!"
    fi
```

## PR Comment Example

The action posts a comment like this on pull requests:

```
## Coverage Report

> [!TIP]
> Coverage improved by **+2.4%** overall

| Metric | Baseline | Current | Delta |
|:-------|:--------:|:-------:|------:|
| Statements | 78.2% | 80.6% | **+2.4%** |
| Branches | 65.1% | 66.9% | **+1.8%** |
| Functions | 82.3% | 84.1% | **+1.8%** |
| Lines | 79.5% | 79.3% | -0.2% |

<table>
<tr><td><strong>Baseline</strong></td><td><code>coverage-production</code> @ <code>c35aeb8</code></td></tr>
<tr><td><strong>Current</strong></td><td><code>cf089de</code></td></tr>
<tr><td><strong>Threshold</strong></td><td>0%</td></tr>
</table>
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Format code
npm run format
```

## License

MIT
