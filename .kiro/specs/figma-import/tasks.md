# Implementation Plan: Figma Import Feature

## Overview

This implementation plan breaks down the Figma Import feature into discrete coding tasks. The feature will be implemented as a CLI tool that connects to the Figma API, parses design data, and generates React/Next.js components with corresponding stylesheets.

The implementation follows a bottom-up approach: core infrastructure → data fetching → parsing → transformation → code generation → orchestration.

## Tasks

- [x] 1. Set up project structure and core types
  - Create directory structure for the figma-import CLI tool
  - Define TypeScript interfaces for Figma API responses (FigmaFile, Node types, Color, Paint, TypeStyle)
  - Define internal data models (ParsedDesign, ParsedNode, StyleInfo, LayoutInfo)
  - Set up testing framework (Jest) with TypeScript configuration
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 1.1 Write unit tests for type definitions
  - Test that TypeScript interfaces correctly type Figma API response fixtures
  - Verify internal data models compile without errors
  - _Requirements: 1.1, 2.1_

- [x] 2. Implement Figma API Client
  - [x] 2.1 Create FigmaApiClient class with authentication method
    - Implement `authenticate(token: string)` that validates token with a test API call
    - Implement `extractFileKey(fileUrl: string)` to parse file key from Figma URLs
    - Handle authentication errors (401) with descriptive messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Write property test for invalid token handling
    - **Property 1: Error Handling for Invalid Tokens**
    - **Validates: Requirements 1.3**
    - Generate various malformed tokens and verify descriptive error messages
    - _Requirements: 1.3_

  - [x] 2.3 Write unit tests for file key extraction
    - Test various Figma URL formats
    - Test edge cases (invalid URLs, missing file key)
    - _Requirements: 1.1_

  - [x] 2.4 Implement getFile method with error handling
    - Implement `getFile(fileKey: string)` using Figma REST API
    - Handle 404 errors for invalid file keys with descriptive messages
    - Implement error context propagation with operation details
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 2.5 Write property test for invalid file key handling
    - **Property 2: Error Handling for Invalid File Keys**
    - **Validates: Requirements 2.3**
    - Generate various invalid file keys and verify error messages
    - _Requirements: 2.3_

  - [x] 2.6 Write property test for error context propagation
    - **Property 4: Error Context Propagation**
    - **Validates: Requirements 2.5**
    - Simulate API errors and verify context is included in error messages
    - _Requirements: 2.5_

  - [x] 2.7 Implement rate limiting with exponential backoff
    - Detect 429 responses and implement exponential backoff (1s, 2s, 4s, 8s, 16s max)
    - Retry up to 5 times before failing
    - _Requirements: 2.4_

  - [x] 2.8 Write property test for exponential backoff
    - **Property 3: Exponential Backoff for Rate Limiting**
    - **Validates: Requirements 2.4**
    - Simulate rate limit sequences and verify retry delays double correctly
    - _Requirements: 2.4_

  - [x] 2.9 Implement getImages method for asset export
    - Implement `getImages(fileKey, nodeIds, options)` for requesting image URLs
    - Handle image export options (format, scale)
    - _Requirements: 6.1, 6.2_

  - [x] 2.10 Write unit tests for getImages method
    - Test image URL request with mock API responses
    - Verify format and scale parameters are passed correctly
    - _Requirements: 6.1, 6.2_

- [x] 3. Checkpoint - API client tests pass
  - Ensure all API client tests pass, ask the user if questions arise.

- [x] 4. Implement Design Parser
  - [x] 4.1 Create DesignParser class with tree traversal
    - Implement `parse(figmaFile: FigmaFile)` that recursively traverses node tree
    - Ensure complete tree traversal visiting every node
    - Preserve parent-child relationships in parsed structure
    - _Requirements: 3.1, 3.3_

  - [x] 4.2 Write property test for complete tree traversal
    - **Property 5: Complete Tree Traversal**
    - **Validates: Requirements 3.1**
    - Generate random node trees and verify all nodes are visited
    - _Requirements: 3.1_

  - [x] 4.3 Write property test for relationship preservation
    - **Property 7: Parent-Child Relationship Preservation**
    - **Validates: Requirements 3.3**
    - Generate node trees and verify parent-child relationships match original
    - _Requirements: 3.3_

  - [x] 4.4 Implement node type classification
    - Identify frames, groups, components, and instances based on type field
    - Map Figma node types to internal node types
    - _Requirements: 3.2_

  - [x] 4.5 Write property test for node type classification
    - **Property 6: Node Type Classification**
    - **Validates: Requirements 3.2**
    - Generate nodes with various types and verify correct classification
    - _Requirements: 3.2_

  - [x] 4.6 Implement property extraction
    - Extract position, size, and layout constraints from nodes
    - Extract all defined node properties without omission
    - _Requirements: 3.4_

  - [x] 4.7 Write property test for property extraction completeness
    - **Property 8: Property Extraction Completeness**
    - **Validates: Requirements 3.4**
    - Generate nodes with various properties and verify all are extracted
    - _Requirements: 3.4_

  - [x] 4.8 Implement unsupported node type handling
    - Log warning for unsupported node types and skip without halting
    - Continue processing sibling nodes after encountering unsupported type
    - _Requirements: 3.5_

  - [x] 4.9 Write property test for unsupported node handling
    - **Property 9: Unsupported Node Handling**
    - **Validates: Requirements 3.5**
    - Generate trees with unsupported node types and verify warnings + continuation
    - _Requirements: 3.5_

  - [x] 4.10 Implement file structure validation
    - Validate Figma file contains at least one exportable frame
    - Validate node names can be used as component names
    - Detect and warn about deeply nested structures (depth > 10)
    - Validate text nodes have defined styles
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

  - [x] 4.11 Write property test for file structure validation
    - **Property 37: File Structure Validation**
    - **Validates: Requirements 12.1**
    - Generate files with and without frames, verify validation
    - _Requirements: 12.1_

  - [x] 4.12 Write property test for nesting depth warning
    - **Property 40: Nesting Depth Warning**
    - **Validates: Requirements 12.4**
    - Generate deeply nested trees and verify warnings for depth > 10
    - _Requirements: 12.4_

  - [x] 4.13 Implement node name sanitization
    - Sanitize node names containing invalid characters for use as component names
    - Log warnings with original and sanitized names
    - Handle reserved keywords and ensure valid JavaScript identifiers
    - _Requirements: 12.2, 12.3_

  - [x] 4.14 Write property test for name sanitization
    - **Property 38: Component Name Validation**
    - **Property 39: Name Sanitization with Warning**
    - **Validates: Requirements 12.2, 12.3**
    - Generate various invalid node names and verify sanitization + warnings
    - _Requirements: 12.2, 12.3_

- [x] 5. Checkpoint - Parser tests pass
  - Ensure all parser tests pass, ask the user if questions arise.

- [x] 6. Implement Style Extractor
  - [x] 6.1 Create StyleExtractor class with typography extraction
    - Extract font family, size, weight, line height from text nodes
    - Extract text color, letter spacing, and alignment
    - Handle missing typography properties with fallbacks
    - _Requirements: 4.1, 4.2_

  - [x] 6.2 Write property test for typography extraction
    - **Property 10: Typography Style Extraction**
    - **Validates: Requirements 4.1, 4.2**
    - Generate random text styles and verify all properties extracted
    - _Requirements: 4.1, 4.2_

  - [x] 6.3 Implement CSS custom properties generation for typography
    - Convert text styles to CSS custom properties (--font-family-*, --font-size-*)
    - Ensure generated CSS is syntactically valid
    - Generate unique CSS class names without collisions
    - _Requirements: 4.3, 4.5_

  - [x] 6.4 Write property test for valid CSS generation
    - **Property 11: Valid CSS Custom Properties Generation**
    - **Property 13: Typography Style Uniqueness**
    - **Validates: Requirements 4.3, 4.5**
    - Generate multiple text styles and verify CSS validity + uniqueness
    - _Requirements: 4.3, 4.5_

  - [x] 6.5 Implement Tailwind typography configuration generation
    - Generate Tailwind config for typography when Tailwind is enabled
    - Map font properties to Tailwind's theme.fontFamily, theme.fontSize
    - _Requirements: 4.4_

  - [x] 6.6 Write property test for Tailwind typography config
    - **Property 12: Tailwind Typography Configuration**
    - **Validates: Requirements 4.4**
    - Generate typography styles and verify valid Tailwind config output
    - _Requirements: 4.4_

  - [x] 6.7 Implement color extraction
    - Extract all fill and stroke colors from nodes
    - Identify and extract named color styles from file
    - _Requirements: 5.1, 5.3_

  - [x] 6.8 Write property test for color extraction completeness
    - **Property 14: Color Extraction Completeness**
    - **Validates: Requirements 5.1, 5.3**
    - Generate nodes with various colors and verify complete extraction
    - _Requirements: 5.1, 5.3_

  - [x] 6.9 Implement RGBA to CSS color conversion
    - Convert Figma RGBA (0-1 range) to CSS rgba(0-255, 0-255, 0-255, 0-1)
    - Handle edge cases (black, white, transparent)
    - _Requirements: 5.2_

  - [x] 6.10 Write property test for RGBA conversion
    - **Property 15: RGBA to CSS Color Conversion**
    - **Validates: Requirements 5.2**
    - Generate random RGBA values and verify correct CSS conversion
    - _Requirements: 5.2_

  - [x] 6.11 Implement Tailwind color configuration generation
    - Generate valid Tailwind theme.colors configuration
    - Map named color styles to Tailwind color names
    - _Requirements: 5.4_

  - [x] 6.12 Write property test for Tailwind color config
    - **Property 16: Tailwind Color Configuration**
    - **Validates: Requirements 5.4**
    - Generate color styles and verify valid Tailwind config output
    - _Requirements: 5.4_

  - [x] 6.13 Implement gradient to CSS conversion
    - Convert gradient fills to CSS linear-gradient() or radial-gradient()
    - Handle color stops and gradient angles correctly
    - _Requirements: 5.5_

  - [x] 6.14 Write property test for gradient conversion
    - **Property 17: Gradient to CSS Conversion**
    - **Validates: Requirements 5.5**
    - Generate various gradients and verify valid CSS gradient syntax
    - _Requirements: 5.5_

  - [x] 6.15 Implement auto-layout to flexbox conversion
    - Convert layoutMode (HORIZONTAL/VERTICAL) to CSS flexbox properties
    - Map primaryAxisAlignItems to justify-content, counterAxisAlignItems to align-items
    - Convert itemSpacing to gap, padding values to CSS padding
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.16 Write property test for auto-layout conversion
    - **Property 26: Auto-Layout to Flexbox Conversion**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - Generate auto-layout configurations and verify correct flexbox CSS
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.17 Implement Tailwind layout classes generation
    - Use Tailwind utility classes (flex, flex-row, justify-center, gap-4) when enabled
    - Map layout properties to appropriate Tailwind classes
    - _Requirements: 8.4_

  - [x] 6.18 Write property test for Tailwind layout classes
    - **Property 27: Tailwind Layout Classes**
    - **Validates: Requirements 8.4**
    - Generate layout properties and verify Tailwind classes used correctly
    - _Requirements: 8.4_

  - [x] 6.19 Implement absolute positioning CSS generation
    - Generate position: absolute with top, left, right, bottom values
    - Handle nodes with absolute positioning layout
    - _Requirements: 8.5_

  - [x] 6.20 Write property test for absolute positioning
    - **Property 28: Absolute Positioning CSS**
    - **Validates: Requirements 8.5**
    - Generate absolutely positioned nodes and verify CSS generation
    - _Requirements: 8.5_

- [x] 7. Checkpoint - Style extractor tests pass
  - Ensure all style extractor tests pass, ask the user if questions arise.

- [x] 8. Implement Asset Downloader
  - [x] 8.1 Create AssetDownloader class with image identification
    - Identify image nodes and extract image resources with node IDs
    - Build list of images to export for API request
    - _Requirements: 6.1_

  - [x] 8.2 Write property test for image resource identification
    - **Property 18: Image Resource Identification**
    - **Validates: Requirements 6.1**
    - Generate nodes with image fills and verify identification
    - _Requirements: 6.1_

  - [x] 8.3 Implement filename generation and sanitization
    - Convert node names to valid filenames (lowercase, replace spaces with hyphens)
    - Remove special characters, ensure valid file system names
    - _Requirements: 6.4_

  - [x] 8.4 Write property test for filename sanitization
    - **Property 19: Filename Sanitization**
    - **Validates: Requirements 6.4**
    - Generate various node names and verify sanitized filenames
    - _Requirements: 6.4_

  - [x] 8.5 Implement filename collision resolution
    - Detect duplicate filenames and append numeric suffixes (-1, -2, -3)
    - Maintain unique filenames across all assets
    - _Requirements: 6.6_

  - [x] 8.6 Write property test for collision resolution
    - **Property 21: Filename Collision Resolution**
    - **Validates: Requirements 6.6**
    - Generate duplicate node names and verify unique filename generation
    - _Requirements: 6.6_

  - [x] 8.7 Implement parallel asset download with error handling
    - Download images to configured assets directory (default: public/figma-assets)
    - Download PNG format at 2x resolution by default
    - Handle individual download failures gracefully, continue with other assets
    - Implement parallel downloads with concurrency limit of 5
    - _Requirements: 6.2, 6.3, 6.5_

  - [x] 8.8 Write property test for resilient download
    - **Property 20: Resilient Asset Download**
    - **Validates: Requirements 6.5**
    - Simulate download failures and verify continuation with other assets
    - _Requirements: 6.5_

  - [x] 8.9 Write unit tests for asset download
    - Test successful downloads with mocked network calls
    - Test file writing to configured directory
    - Verify default format (PNG) and scale (2x)
    - _Requirements: 6.2, 6.3_

- [x] 9. Checkpoint - Asset downloader tests pass
  - Ensure all asset downloader tests pass, ask the user if questions arise.

- [ ] 10. Implement Component Generator
  - [x] 10.1 Create ComponentGenerator class with basic component generation
    - Generate React functional components from frames and components
    - Generate TypeScript component files with proper type definitions
    - Apply extracted styles as className properties
    - Generate semantic HTML elements based on node types
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 10.2 Write property test for React component generation
    - **Property 22: React Component Generation**
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5**
    - Generate random component structures and verify valid React/TypeScript code
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 10.3 Implement Next.js Image component integration
    - Use Next.js Image component for image elements with correct props
    - Set src, alt, width, and height properties correctly
    - _Requirements: 7.3_

  - [x] 10.4 Write property test for Next.js Image usage
    - **Property 23: Next.js Image Component Usage**
    - **Validates: Requirements 7.3**
    - Generate image nodes and verify Next.js Image component usage
    - _Requirements: 7.3_

  - [~] 10.5 Implement component hierarchy preservation
    - Generate nested JSX elements or component imports for nested structures
    - Preserve node tree hierarchy in generated component code
    - _Requirements: 7.6_

  - [x] 10.6 Write property test for hierarchy preservation
    - **Property 24: Component Hierarchy Preservation**
    - **Validates: Requirements 7.6**
    - Generate nested node trees and verify hierarchy in generated code
    - _Requirements: 7.6_

  - [x] 10.7 Implement variant props generation
    - Generate TypeScript props interfaces for components with variants
    - Create union types for each variant property
    - _Requirements: 7.7_

  - [x] 10.8 Write property test for variant props
    - **Property 25: Component Variant Props**
    - **Validates: Requirements 7.7**
    - Generate components with variants and verify props interface
    - _Requirements: 7.7_

  - [x] 10.9 Implement component definition and instance handling
    - Generate reusable React components for Figma component definitions
    - Generate import statements and references for component instances
    - Maintain mapping between Figma component IDs and generated component names
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 10.10 Write property test for component references
    - **Property 29: Component Definition Generation**
    - **Property 30: Component Instance Reference**
    - **Property 32: Component ID Mapping**
    - **Validates: Requirements 9.1, 9.2, 9.4**
    - Generate component instances and verify correct references
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 10.11 Implement instance override props
    - Generate props for overridable properties in component instances
    - Pass overridden values to base component
    - _Requirements: 9.3_

  - [x] 10.12 Write property test for instance overrides
    - **Property 31: Instance Override Props**
    - **Validates: Requirements 9.3**
    - Generate instances with overrides and verify props generation
    - _Requirements: 9.3_

  - [x] 10.13 Implement naming convention support
    - Apply configured naming convention (pascal, kebab, camel) to component names
    - Ensure generated names are valid JavaScript identifiers
    - _Requirements: 10.2_

  - [x] 10.14 Write unit tests for naming conventions
    - Test pascal case conversion
    - Test kebab case conversion
    - Test camel case conversion
    - _Requirements: 10.2_

- [x] 11. Checkpoint - Component generator tests pass
  - Ensure all component generator tests pass, ask the user if questions arise.

- [x] 12. Implement Stylesheet Generation
  - [x] 12.1 Create stylesheet generator for CSS modules
    - Generate .module.css files when Tailwind is disabled
    - Include all extracted styles in CSS format
    - _Requirements: 10.4_

  - [x] 12.2 Write property test for CSS modules output
    - **Property 34: Conditional CSS Modules Output**
    - **Validates: Requirements 10.4**
    - Generate styles with Tailwind disabled and verify CSS modules
    - _Requirements: 10.4_

  - [x] 12.3 Implement Tailwind utility class generation
    - Use Tailwind utility classes when Tailwind is enabled
    - Apply classes to className properties in generated components
    - _Requirements: 10.3_

  - [x] 12.4 Write property test for Tailwind output
    - **Property 33: Conditional Tailwind Output**
    - **Validates: Requirements 10.3**
    - Generate styles with Tailwind enabled and verify utility classes used
    - _Requirements: 10.3_

- [x] 13. Implement Configuration Management
  - [x] 13.1 Create configuration loader and validator
    - Load configuration from file or CLI arguments
    - Support all configuration options (output dirs, naming, Tailwind, image options)
    - Apply default values for missing optional settings
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 13.2 Write property test for configuration defaults
    - **Property 35: Configuration Defaults**
    - **Validates: Requirements 10.6**
    - Generate configs with missing values and verify defaults applied
    - _Requirements: 10.6_

  - [x] 13.3 Write unit tests for configuration loading
    - Test loading from config file
    - Test loading from CLI arguments
    - Test CLI arguments override config file
    - Test environment variable for token
    - _Requirements: 10.1, 10.2_

- [x] 14. Implement CLI Interface
  - [x] 14.1 Create CLI entry point with argument parsing
    - Parse command-line arguments (file-url, token, output-dir, etc.)
    - Support all CLI options defined in design
    - Load configuration file when --config is provided
    - _Requirements: 10.1_

  - [x] 14.2 Write unit tests for CLI argument parsing
    - Test various CLI flag combinations
    - Test config file path loading
    - Test environment variable fallback for token
    - _Requirements: 10.1_

  - [x] 14.3 Implement CLI help and usage messages
    - Display help text with --help flag
    - Show usage examples
    - Display clear error messages for missing required arguments

- [x] 15. Implement Summary Report Generator
  - [x] 15.1 Create summary report generation
    - Count components generated and assets downloaded
    - List all generated file paths
    - Include all warnings and errors encountered during import
    - Output summary to console and save to import-summary.json
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 15.2 Write property test for summary report accuracy
    - **Property 36: Summary Report Accuracy**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
    - Generate imports and verify counts and lists match actual results
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [x] 15.3 Write unit tests for summary report
    - Test report structure and format
    - Test console output and file output
    - Verify report includes all required sections
    - _Requirements: 11.1, 11.6_

- [x] 16. Implement Figma Importer Orchestrator
  - [x] 16.1 Create FigmaImporter class that orchestrates workflow
    - Validate configuration at start
    - Coordinate all components (API client, parser, extractor, generator, downloader)
    - Execute workflow steps in correct order
    - Handle errors and collect warnings throughout workflow
    - Generate and return ImportResult with summary
    - _Requirements: All requirements_

  - [x] 16.2 Write integration test for complete workflow
    - Use fixture Figma file data (JSON)
    - Mock API calls to avoid real Figma API usage
    - Verify complete import from file URL to generated files
    - Validate all generated files are created correctly
    - Verify summary report accuracy
    - _Requirements: All requirements_

- [ ] 17. Wire everything together and test end-to-end
  - [x] 17.1 Create CLI executable and package configuration
    - Set up package.json bin field for CLI command
    - Configure TypeScript compilation for CLI distribution
    - Test CLI installation and execution

  - [x] 17.2 Test with real Figma file (provided credentials)
    - Use provided Figma token and file URL
    - Execute complete import against SITOMAS design file
    - Verify all components, assets, and styles are generated correctly
    - Review generated React components for correctness
    - Ensure Next.js Image components work correctly
    - Validate TypeScript compilation of generated components

  - [-] 17.3 Write end-to-end test suite
    - Test complete CLI workflow from command to output
    - Test various configuration combinations
    - Test error scenarios (invalid token, missing file)
    - Verify generated code is valid and compiles

- [~] 18. Final checkpoint - Complete feature verification
  - Ensure all tests pass (unit, property, integration, e2e)
  - Verify generated components compile and work in Next.js app
  - Review summary report for accuracy
  - Ask the user if questions arise or if feature is ready for use

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and integration points
- The implementation uses TypeScript with Next.js for the target application
- Testing uses Jest for unit tests and fast-check for property-based tests
- All generated components must be valid React/TypeScript code that compiles
- The CLI tool should be usable as `npx figma-import` or similar
- Real Figma API credentials are available for testing: Token `igd_gEMDzopnjwS_T8oswFLhOSF_Ea7TfqNlb8ymQXdF`, File `X32KZDNlVmGv1R001k8AzR`

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.3", "2.4"]
    },
    {
      "id": 2,
      "tasks": ["2.5", "2.6", "2.7", "2.8", "2.9", "2.10"]
    },
    {
      "id": 3,
      "tasks": ["4.1", "4.4"]
    },
    {
      "id": 4,
      "tasks": ["4.2", "4.3", "4.5", "4.6", "4.8", "4.10", "4.13"]
    },
    {
      "id": 5,
      "tasks": ["4.7", "4.9", "4.11", "4.12", "4.14"]
    },
    {
      "id": 6,
      "tasks": ["6.1", "6.7", "6.9", "6.13", "6.15", "6.19"]
    },
    {
      "id": 7,
      "tasks": ["6.2", "6.3", "6.5", "6.8", "6.10", "6.11", "6.16", "6.17", "6.20"]
    },
    {
      "id": 8,
      "tasks": ["6.4", "6.6", "6.12", "6.14", "6.18"]
    },
    {
      "id": 9,
      "tasks": ["8.1", "8.3", "8.5"]
    },
    {
      "id": 10,
      "tasks": ["8.2", "8.4", "8.6", "8.7"]
    },
    {
      "id": 11,
      "tasks": ["8.8", "8.9"]
    },
    {
      "id": 12,
      "tasks": ["10.1", "10.3", "10.7", "10.9", "10.11", "10.13"]
    },
    {
      "id": 13,
      "tasks": ["10.2", "10.4", "10.6", "10.8", "10.10", "10.12", "10.14"]
    },
    {
      "id": 14,
      "tasks": ["12.1", "12.3"]
    },
    {
      "id": 15,
      "tasks": ["12.2", "12.4"]
    },
    {
      "id": 16,
      "tasks": ["13.1"]
    },
    {
      "id": 17,
      "tasks": ["13.2", "13.3"]
    },
    {
      "id": 18,
      "tasks": ["14.1", "14.3"]
    },
    {
      "id": 19,
      "tasks": ["14.2"]
    },
    {
      "id": 20,
      "tasks": ["15.1"]
    },
    {
      "id": 21,
      "tasks": ["15.2", "15.3"]
    },
    {
      "id": 22,
      "tasks": ["16.1"]
    },
    {
      "id": 23,
      "tasks": ["16.2"]
    },
    {
      "id": 24,
      "tasks": ["17.1", "17.2"]
    },
    {
      "id": 25,
      "tasks": ["17.3"]
    }
  ]
}
```
