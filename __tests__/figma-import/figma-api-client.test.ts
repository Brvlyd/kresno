/**
 * Unit tests for FigmaApiClient
 */

import {
  FigmaApiClient,
  FigmaAuthenticationError,
  FigmaFileError,
  FigmaRateLimitError,
} from '../../lib/figma-import/core/figma-api-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('FigmaApiClient', () => {
  let client: FigmaApiClient;

  beforeEach(() => {
    client = new FigmaApiClient();
    mockFetch.mockReset();
  });

  describe('authenticate', () => {
    it('should successfully authenticate with a valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-user', email: 'test@example.com' }),
      });

      await expect(client.authenticate('valid-token-123')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/me',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Figma-Token': 'valid-token-123',
          },
        })
      );
    });

    it('should throw FigmaAuthenticationError for empty token', async () => {
      await expect(client.authenticate('')).rejects.toThrow(FigmaAuthenticationError);
      await expect(client.authenticate('')).rejects.toThrow(
        'Invalid token: Token cannot be empty'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw FigmaAuthenticationError for whitespace-only token', async () => {
      await expect(client.authenticate('   ')).rejects.toThrow(FigmaAuthenticationError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw FigmaAuthenticationError for 401 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(client.authenticate('invalid-token')).rejects.toThrow(
        FigmaAuthenticationError
      );
      await expect(client.authenticate('invalid-token')).rejects.toThrow(
        /Invalid or expired token/
      );
    });

    it('should throw FigmaAuthenticationError for 403 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(client.authenticate('restricted-token')).rejects.toThrow(
        FigmaAuthenticationError
      );
      await expect(client.authenticate('restricted-token')).rejects.toThrow(
        /Access forbidden/
      );
    });

    it('should throw FigmaAuthenticationError for other non-200 status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.authenticate('token')).rejects.toThrow(FigmaAuthenticationError);
      await expect(client.authenticate('token')).rejects.toThrow(/status 500/);
    });

    it('should throw FigmaAuthenticationError for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.authenticate('token')).rejects.toThrow(FigmaAuthenticationError);
      await expect(client.authenticate('token')).rejects.toThrow(/network error/i);
    });
  });

  describe('extractFileKey', () => {
    it('should extract file key from standard Figma file URL', () => {
      const url = 'https://www.figma.com/file/ABC123XYZ/My-Design-File';
      expect(client.extractFileKey(url)).toBe('ABC123XYZ');
    });

    it('should extract file key from Figma design URL', () => {
      const url = 'https://www.figma.com/design/DEF456UVW/Another-Design';
      expect(client.extractFileKey(url)).toBe('DEF456UVW');
    });

    it('should extract file key from URL with query parameters', () => {
      const url = 'https://www.figma.com/file/GHI789RST/Design?node-id=1:2';
      expect(client.extractFileKey(url)).toBe('GHI789RST');
    });

    it('should extract file key from URL with trailing slash', () => {
      const url = 'https://www.figma.com/file/JKL012MNO/My-Design/';
      expect(client.extractFileKey(url)).toBe('JKL012MNO');
    });

    it('should extract file key with alphanumeric characters', () => {
      const url = 'https://www.figma.com/file/Abc123Xyz456/Test';
      expect(client.extractFileKey(url)).toBe('Abc123Xyz456');
    });

    it('should throw FigmaFileError for empty URL', () => {
      expect(() => client.extractFileKey('')).toThrow(FigmaFileError);
      expect(() => client.extractFileKey('')).toThrow(/URL cannot be empty/);
    });

    it('should throw FigmaFileError for whitespace-only URL', () => {
      expect(() => client.extractFileKey('   ')).toThrow(FigmaFileError);
    });

    it('should throw FigmaFileError for invalid URL format', () => {
      expect(() => client.extractFileKey('not-a-figma-url')).toThrow(FigmaFileError);
      expect(() => client.extractFileKey('not-a-figma-url')).toThrow(/Invalid Figma file URL format/);
    });

    it('should throw FigmaFileError for URL without file key', () => {
      expect(() => client.extractFileKey('https://www.figma.com/files')).toThrow(
        FigmaFileError
      );
    });

    it('should throw FigmaFileError for non-Figma URL', () => {
      expect(() => client.extractFileKey('https://www.example.com/file/ABC123/test')).toThrow(
        FigmaFileError
      );
    });

    it('should provide descriptive error with invalid URL in message', () => {
      const invalidUrl = 'https://invalid.com/test';
      expect(() => client.extractFileKey(invalidUrl)).toThrow(invalidUrl);
    });
  });

  describe('getFile', () => {
    beforeEach(async () => {
      // Authenticate before testing getFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-user' }),
      });
      await client.authenticate('test-token');
      mockFetch.mockReset();
    });

    it('should successfully fetch file data with valid file key', async () => {
      const mockFileData = {
        name: 'Test Design',
        lastModified: '2024-01-01T00:00:00Z',
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFileData,
      });

      const result = await client.getFile('ABC123');

      expect(result).toEqual(mockFileData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/ABC123',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Figma-Token': 'test-token',
          },
        })
      );
    });

    it('should throw FigmaAuthenticationError when not authenticated', async () => {
      const unauthenticatedClient = new FigmaApiClient();
      
      await expect(unauthenticatedClient.getFile('ABC123')).rejects.toThrow(
        FigmaAuthenticationError
      );
      await expect(unauthenticatedClient.getFile('ABC123')).rejects.toThrow(
        /Not authenticated/
      );
    });

    it('should throw FigmaFileError for empty file key', async () => {
      await expect(client.getFile('')).rejects.toThrow(FigmaFileError);
      await expect(client.getFile('')).rejects.toThrow(/File key cannot be empty/);
    });

    it('should throw FigmaFileError for 404 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(client.getFile('NOTFOUND')).rejects.toThrow(FigmaFileError);
      await expect(client.getFile('NOTFOUND')).rejects.toThrow(/File not found/);
      await expect(client.getFile('NOTFOUND')).rejects.toThrow(/NOTFOUND/);
    });

    it('should throw FigmaFileError for 403 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(client.getFile('FORBIDDEN')).rejects.toThrow(FigmaFileError);
      await expect(client.getFile('FORBIDDEN')).rejects.toThrow(/Access forbidden/);
    });

    it('should throw FigmaAuthenticationError for 401 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(client.getFile('ABC123')).rejects.toThrow(FigmaAuthenticationError);
      await expect(client.getFile('ABC123')).rejects.toThrow(/Authentication expired/);
    });

    it('should throw FigmaFileError for other error status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.getFile('ABC123')).rejects.toThrow(FigmaFileError);
      await expect(client.getFile('ABC123')).rejects.toThrow(/status 500/);
    });

    it('should throw FigmaFileError for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getFile('ABC123')).rejects.toThrow(FigmaFileError);
      await expect(client.getFile('ABC123')).rejects.toThrow(/Network error/);
    });

    it('should include file key in error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(client.getFile('MY_FILE_KEY')).rejects.toThrow(/MY_FILE_KEY/);
    });
  });

  describe('getImages', () => {
    beforeEach(async () => {
      // Authenticate before testing getImages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-user' }),
      });
      await client.authenticate('test-token');
      mockFetch.mockReset();
    });

    it('should successfully fetch image URLs with valid parameters', async () => {
      const mockImageData = {
        err: null,
        images: {
          '1:1': 'https://s3-alpha.figma.com/img1.png',
          '1:2': 'https://s3-alpha.figma.com/img2.png',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockImageData,
      });

      const result = await client.getImages('ABC123', ['1:1', '1:2'], {
        format: 'png',
        scale: 2,
      });

      expect(result).toEqual(mockImageData.images);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.figma.com/v1/images/ABC123'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Figma-Token': 'test-token',
          },
        })
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('ids=1%3A1%2C1%3A2'); // URL encoded
      expect(callUrl).toContain('format=png');
      expect(callUrl).toContain('scale=2');
    });

    it('should return empty object for empty node IDs array', async () => {
      const result = await client.getImages('ABC123', [], { format: 'png' });
      expect(result).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle contentsOnly option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ err: null, images: {} }),
      });

      await client.getImages('ABC123', ['1:1'], {
        format: 'svg',
        contentsOnly: true,
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('contents_only=true');
    });

    it('should throw FigmaAuthenticationError when not authenticated', async () => {
      const unauthenticatedClient = new FigmaApiClient();

      await expect(
        unauthenticatedClient.getImages('ABC123', ['1:1'], { format: 'png' })
      ).rejects.toThrow(FigmaAuthenticationError);
    });

    it('should throw FigmaFileError for empty file key', async () => {
      await expect(
        client.getImages('', ['1:1'], { format: 'png' })
      ).rejects.toThrow(FigmaFileError);
    });

    it('should throw FigmaFileError for 404 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        client.getImages('NOTFOUND', ['1:1'], { format: 'png' })
      ).rejects.toThrow(FigmaFileError);
      await expect(
        client.getImages('NOTFOUND', ['1:1'], { format: 'png' })
      ).rejects.toThrow(/File not found/);
    });

    it('should throw FigmaAuthenticationError for 401 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(
        client.getImages('ABC123', ['1:1'], { format: 'png' })
      ).rejects.toThrow(FigmaAuthenticationError);
    });

    it('should throw FigmaFileError when API returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          err: 'Invalid node IDs',
          images: null,
        }),
      });

      await expect(
        client.getImages('ABC123', ['invalid'], { format: 'png' })
      ).rejects.toThrow(FigmaFileError);
      await expect(
        client.getImages('ABC123', ['invalid'], { format: 'png' })
      ).rejects.toThrow(/Invalid node IDs/);
    });

    it('should throw FigmaFileError for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        client.getImages('ABC123', ['1:1'], { format: 'png' })
      ).rejects.toThrow(FigmaFileError);
    });
  });

  describe('Error message quality', () => {
    it('should provide descriptive authentication error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      try {
        await client.authenticate('bad-token');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FigmaAuthenticationError);
        if (error instanceof FigmaAuthenticationError) {
          expect(error.message).toContain('Invalid or expired token');
          expect(error.message).toContain('Figma personal access token');
        }
      }
    });

    it('should provide descriptive file key extraction error messages', () => {
      expect(() => client.extractFileKey('https://example.com/not-a-figma-url')).toThrow(
        FigmaFileError
      );
      
      try {
        client.extractFileKey('https://example.com/not-a-figma-url');
      } catch (error) {
        expect(error).toBeInstanceOf(FigmaFileError);
        if (error instanceof FigmaFileError) {
          expect(error.message).toContain('Invalid Figma file URL format');
          expect(error.message).toContain('Expected format');
        }
      }
    });
  });

  describe('Rate limiting with exponential backoff', () => {
    beforeEach(async () => {
      // Authenticate before testing rate limiting
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-user' }),
      });
      await client.authenticate('test-token');
      mockFetch.mockReset();
    });

    it('should retry with exponential backoff on 429 response and eventually succeed', async () => {
      jest.useFakeTimers();

      // Mock 429 responses for first 3 attempts, then success
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 }) // Attempt 0: 1s delay
        .mockResolvedValueOnce({ ok: false, status: 429 }) // Attempt 1: 2s delay
        .mockResolvedValueOnce({ ok: false, status: 429 }) // Attempt 2: 4s delay
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            name: 'Test File',
            document: { id: '0:0', name: 'Document', type: 'DOCUMENT', visible: true, children: [] },
          }),
        });

      const filePromise = client.getFile('ABC123');

      // Fast-forward through the delays
      await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
      await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s
      await jest.advanceTimersByTimeAsync(4000); // Third retry after 4s

      const result = await filePromise;

      expect(result.name).toBe('Test File');
      expect(mockFetch).toHaveBeenCalledTimes(4); // 3 failures + 1 success

      jest.useRealTimers();
    });

    it('should apply exponential backoff to getImages method', async () => {
      jest.useFakeTimers();

      // Mock 429 responses for first 2 attempts, then success
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            err: null,
            images: { '1:1': 'https://example.com/image.png' },
          }),
        });

      const imagesPromise = client.getImages('ABC123', ['1:1'], { format: 'png' });

      // Fast-forward through the delays
      await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
      await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s

      const result = await imagesPromise;

      expect(result['1:1']).toBe('https://example.com/image.png');
      expect(mockFetch).toHaveBeenCalledTimes(3); // 2 failures + 1 success

      jest.useRealTimers();
    });

    it('should not retry on non-429 error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(client.getFile('NOTFOUND')).rejects.toThrow(FigmaFileError);
      
      // Reset mock and test again to verify the error message
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      
      await expect(client.getFile('NOTFOUND')).rejects.toThrow(/File not found/);

      // Should only call once per getFile, no retries
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
