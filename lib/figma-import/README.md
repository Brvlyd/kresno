# Figma Import Tool

A CLI tool for importing Figma designs into Next.js TypeScript applications. Connects to the Figma API, parses design data, and generates React components with corresponding stylesheets.

## Project Structure

```
lib/figma-import/
├── types/                    # TypeScript type definitions
│   ├── figma-api.ts         # Figma REST API response types
│   ├── internal-models.ts   # Internal data models
│   ├── config.ts            # Configuration types
│   └── index.ts             # Type exports
├── utils/                   # Utility functions
│   ├── name-sanitizer.ts    # Name sanitization utilities
│   └── index.ts             # Utility exports
├── core/                    # Core modules (to be implemented)
│   └── index.ts             # Core exports
├── index.ts                 # Main entry point
└── README.md               # This file
```

## Features

- **Authentication**: Secure connection to Figma API using personal access tokens
- **Design Parsing**: Traversal and interpretation of Figma's node tree structure
- **Component Generation**: Automated creation of React/Next.js components from Figma frames
- **Style Extraction**: Conversion of Figma styles (typography, colors, layouts) to CSS/Tailwind
- **Asset Management**: Download and organization of image assets
- **Configuration**: Flexible output customization and naming conventions

## Type Definitions

### Figma API Types
- `FigmaFile`: Complete Figma file response
- `Node`: Base node interface
- `FrameNode`, `TextNode`, `ComponentNode`, etc.: Specific node types
- `Color`: RGBA color definition (0-1 range)
- `Paint`: Fill and stroke definitions
- `TypeStyle`: Typography style properties

### Internal Models
- `ParsedDesign`: Intermediate representation of design data
- `ParsedNode`: Parsed node with sanitized names and layout info
- `LayoutInfo`: Flexbox and positioning properties
- `StyleInfo`: CSS properties and Tailwind classes

### Configuration
- `ImportConfig`: Configuration for import process
- `ImportResult`: Result summary with counts and errors

## Testing

This project uses Jest with TypeScript for testing.

### Run Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

### Test Files
- `__tests__/figma-import/types.test.ts`: Type definition tests
- `__tests__/figma-import/name-sanitizer.test.ts`: Name sanitization tests

## Development Status

### ✅ Task 1: Project Structure and Core Types (Completed)
- [x] Directory structure created
- [x] TypeScript interfaces for Figma API responses
- [x] Internal data models defined
- [x] Jest testing framework configured
- [x] Basic utility functions implemented
- [x] Unit tests passing (27 tests)

### 🔜 Next Steps
- Task 2: Implement Figma API Client
- Task 3: Implement Design Parser
- Task 4: Implement Style Extractor
- Task 5: Implement Component Generator
- Task 6: Implement Asset Downloader
- Task 7: Implement CLI Interface

## Requirements Validated

This implementation validates the following requirements:
- **Requirement 1.1**: Type definitions for authentication with Figma API
- **Requirement 2.1**: Type definitions for Figma file data structures
- **Requirement 3.1**: Internal models for parsed design structure

## Usage (Planned)

```typescript
import { FigmaImporter } from '@/lib/figma-import';

const config = {
  fileUrl: 'https://www.figma.com/design/X32KZDNlVmGv1R001k8AzR/SITOMAS',
  token: process.env.FIGMA_TOKEN,
  outputDir: './components/figma',
  assetsDir: './public/figma-assets',
  useTailwind: true,
  namingConvention: 'pascal',
  imageFormat: 'png',
  imageScale: 2,
};

const result = await importer.import(config);
console.log(`Generated ${result.componentsGenerated} components`);
```

## Environment Setup

### Prerequisites
- Node.js 18+ (currently running v23.8.0)
- TypeScript 5+
- Next.js 16+
- Jest 30+ for testing

### Dependencies
- `jest`: Testing framework
- `@types/jest`: Jest type definitions
- `ts-jest`: TypeScript support for Jest
- `ts-node`: TypeScript execution

## Credentials (Development)

For testing purposes, use the following credentials:
- **Token**: `igd_gEMDzopnjwS_T8oswFLhOSF_Ea7TfqNlb8ymQXdF`
- **File URL**: `https://www.figma.com/design/X32KZDNlVmGv1R001k8AzR/SITOMAS`
- **File Key**: `X32KZDNlVmGv1R001k8AzR`

> ⚠️ **Note**: Store credentials in environment variables for production use.
