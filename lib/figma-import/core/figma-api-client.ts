/**
 * Figma API Client
 * Handles authentication and communication with Figma REST API
 */

import { FigmaFile, ImageUrls, ImageExportOptions } from '../types/figma-api';

/**
 * Error thrown when authentication fails
 */
export class FigmaAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigmaAuthenticationError';
  }
}

/**
 * Error thrown when file key extraction or access fails
 */
export class FigmaFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigmaFileError';
  }
}

/**
 * Error thrown when rate limit is exceeded after retries
 */
export class FigmaRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigmaRateLimitError';
  }
}

/**
 * Figma API Client for interacting with the Figma REST API
 */
export class FigmaApiClient {
  private baseUrl = 'https://api.figma.com/v1';
  private token: string | null = null;
  private readonly maxRetries = 5;
  private readonly initialDelayMs = 1000; // 1 second
  private readonly maxDelayMs = 16000; // 16 seconds

  /**
   * Delay execution for the specified number of milliseconds
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   * @param attempt - The current attempt number (0-indexed)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = this.initialDelayMs * Math.pow(2, attempt);
    return Math.min(delay, this.maxDelayMs);
  }

  /**
   * Execute a fetch request with exponential backoff on rate limiting
   * @param url - The URL to fetch
   * @param options - Fetch options
   * @returns Response object
   * @throws {FigmaRateLimitError} If rate limit is exceeded after all retries
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // If we get a 429, retry with exponential backoff
        if (response.status === 429) {
          if (attempt < this.maxRetries) {
            const delayMs = this.calculateBackoffDelay(attempt);
            await this.delay(delayMs);
            continue; // Retry
          } else {
            // Max retries exceeded
            throw new FigmaRateLimitError(
              `Rate limit exceeded: Maximum retry attempts (${this.maxRetries}) reached. Please wait before making more requests to the Figma API.`
            );
          }
        }

        // For non-429 responses, return immediately
        return response;
      } catch (error) {
        // Network or other errors
        if (error instanceof FigmaRateLimitError) {
          throw error;
        }
        
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on network errors, throw immediately
        throw lastError;
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Unexpected error in fetchWithRetry');
  }

  /**
   * Validates token with a test API call
   * @param token - Figma personal access token
   * @throws {FigmaAuthenticationError} If token is invalid or authentication fails
   */
  async authenticate(token: string): Promise<void> {
    if (!token || token.trim().length === 0) {
      throw new FigmaAuthenticationError(
        'Invalid token: Token cannot be empty. Please provide a valid Figma personal access token.'
      );
    }

    // Test the token with a minimal API call to /v1/me endpoint
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        headers: {
          'X-Figma-Token': token,
        },
      });

      if (response.status === 401) {
        throw new FigmaAuthenticationError(
          'Authentication failed: Invalid or expired token. Please check your Figma personal access token and ensure it has the required permissions.'
        );
      }

      if (response.status === 403) {
        throw new FigmaAuthenticationError(
          'Authentication failed: Access forbidden. Your token may lack the necessary permissions to access Figma files.'
        );
      }

      if (!response.ok) {
        throw new FigmaAuthenticationError(
          `Authentication failed: Received status ${response.status} from Figma API. Please verify your token is valid.`
        );
      }

      // If successful, store the token
      this.token = token;
    } catch (error) {
      if (error instanceof FigmaAuthenticationError) {
        throw error;
      }

      // Network or other errors
      if (error instanceof Error) {
        throw new FigmaAuthenticationError(
          `Authentication failed due to network error: ${error.message}. Please check your internet connection and try again.`
        );
      }

      throw new FigmaAuthenticationError(
        'Authentication failed due to an unexpected error. Please try again.'
      );
    }
  }

  /**
   * Extracts the file key from a Figma file URL
   * @param fileUrl - Figma file URL (e.g., "https://www.figma.com/file/ABC123/MyDesign")
   * @returns The extracted file key
   * @throws {FigmaFileError} If URL is invalid or file key cannot be extracted
   */
  extractFileKey(fileUrl: string): string {
    if (!fileUrl || fileUrl.trim().length === 0) {
      throw new FigmaFileError(
        'Invalid file URL: URL cannot be empty. Please provide a valid Figma file URL.'
      );
    }

    // Figma file URLs follow the pattern:
    // https://www.figma.com/file/{fileKey}/{fileName}
    // or https://www.figma.com/design/{fileKey}/{fileName}
    const filePattern = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/;
    const match = fileUrl.match(filePattern);

    if (!match || !match[2]) {
      throw new FigmaFileError(
        `Invalid Figma file URL format: "${fileUrl}". Expected format: https://www.figma.com/file/{fileKey}/{fileName} or https://www.figma.com/design/{fileKey}/{fileName}`
      );
    }

    return match[2];
  }

  /**
   * Fetches complete file data from Figma API
   * @param fileKey - The Figma file key
   * @returns Promise resolving to the complete file data
   * @throws {FigmaFileError} If file cannot be accessed
   * @throws {FigmaAuthenticationError} If not authenticated
   * @throws {FigmaRateLimitError} If rate limit is exceeded after retries
   */
  async getFile(fileKey: string): Promise<FigmaFile> {
    if (!this.token) {
      throw new FigmaAuthenticationError(
        'Not authenticated: Please call authenticate() before making API requests.'
      );
    }

    if (!fileKey || fileKey.trim().length === 0) {
      throw new FigmaFileError(
        'Invalid file key: File key cannot be empty.'
      );
    }

    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/files/${fileKey}`,
        {
          method: 'GET',
          headers: {
            'X-Figma-Token': this.token,
          },
        }
      );

      if (response.status === 404) {
        throw new FigmaFileError(
          `File not found: The file with key "${fileKey}" does not exist or you do not have permission to access it. Please check the file URL and your access permissions.`
        );
      }

      if (response.status === 403) {
        throw new FigmaFileError(
          `Access forbidden: You do not have permission to access the file with key "${fileKey}". Please check that the file is shared with you or that your token has the correct permissions.`
        );
      }

      if (response.status === 401) {
        throw new FigmaAuthenticationError(
          'Authentication expired: Your token is no longer valid. Please re-authenticate.'
        );
      }

      if (!response.ok) {
        throw new FigmaFileError(
          `Failed to fetch file: Received status ${response.status} from Figma API for file "${fileKey}".`
        );
      }

      const data = await response.json();
      return data as FigmaFile;
    } catch (error) {
      if (
        error instanceof FigmaFileError ||
        error instanceof FigmaAuthenticationError ||
        error instanceof FigmaRateLimitError
      ) {
        throw error;
      }

      // Network or parsing errors
      if (error instanceof Error) {
        throw new FigmaFileError(
          `Failed to fetch file "${fileKey}" due to error: ${error.message}`
        );
      }

      throw new FigmaFileError(
        `Failed to fetch file "${fileKey}" due to an unexpected error.`
      );
    }
  }

  /**
   * Requests image export URLs from Figma API
   * @param fileKey - The Figma file key
   * @param nodeIds - Array of node IDs to export as images
   * @param options - Export options (format, scale, etc.)
   * @returns Promise resolving to a map of node IDs to image URLs
   * @throws {FigmaFileError} If image export fails
   * @throws {FigmaAuthenticationError} If not authenticated
   * @throws {FigmaRateLimitError} If rate limit is exceeded after retries
   */
  async getImages(
    fileKey: string,
    nodeIds: string[],
    options: ImageExportOptions
  ): Promise<ImageUrls> {
    if (!this.token) {
      throw new FigmaAuthenticationError(
        'Not authenticated: Please call authenticate() before making API requests.'
      );
    }

    if (!fileKey || fileKey.trim().length === 0) {
      throw new FigmaFileError(
        'Invalid file key: File key cannot be empty.'
      );
    }

    if (!nodeIds || nodeIds.length === 0) {
      return {}; // Return empty object if no nodes to export
    }

    try {
      // Build query parameters
      const params = new URLSearchParams({
        ids: nodeIds.join(','),
        format: options.format,
      });

      if (options.scale !== undefined) {
        params.append('scale', options.scale.toString());
      }

      if (options.contentsOnly !== undefined) {
        params.append('contents_only', options.contentsOnly.toString());
      }

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/images/${fileKey}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'X-Figma-Token': this.token,
          },
        }
      );

      if (response.status === 404) {
        throw new FigmaFileError(
          `File not found: Cannot export images from file "${fileKey}". The file may not exist or you may not have access.`
        );
      }

      if (response.status === 401) {
        throw new FigmaAuthenticationError(
          'Authentication expired: Your token is no longer valid. Please re-authenticate.'
        );
      }

      if (!response.ok) {
        throw new FigmaFileError(
          `Failed to export images: Received status ${response.status} from Figma API for file "${fileKey}".`
        );
      }

      const data = await response.json();
      
      // Figma API returns { err: null, images: { nodeId: url } } on success
      if (data.err) {
        throw new FigmaFileError(
          `Failed to export images: ${data.err}`
        );
      }

      return data.images as ImageUrls;
    } catch (error) {
      if (
        error instanceof FigmaFileError ||
        error instanceof FigmaAuthenticationError ||
        error instanceof FigmaRateLimitError
      ) {
        throw error;
      }

      // Network or parsing errors
      if (error instanceof Error) {
        throw new FigmaFileError(
          `Failed to export images from file "${fileKey}" due to error: ${error.message}`
        );
      }

      throw new FigmaFileError(
        `Failed to export images from file "${fileKey}" due to an unexpected error.`
      );
    }
  }
}
