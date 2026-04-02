import { describe, it, expect } from 'vitest';
import { ApiError, InvalidTickerError, DataProcessingError } from '../services/errors';

describe('ApiError', () => {
  it('is an instance of Error', () => {
    expect(new ApiError('test')).toBeInstanceOf(Error);
  });

  it('has name "ApiError"', () => {
    expect(new ApiError('test').name).toBe('ApiError');
  });

  it('stores the message', () => {
    expect(new ApiError('network failure').message).toBe('network failure');
  });

  it('can be caught as an Error', () => {
    expect(() => {
      throw new ApiError('fail');
    }).toThrow(Error);
  });

  it('can be caught by its specific type', () => {
    expect(() => {
      throw new ApiError('fail');
    }).toThrow(ApiError);
  });
});

describe('InvalidTickerError', () => {
  it('is an instance of Error', () => {
    expect(new InvalidTickerError('FAKE')).toBeInstanceOf(Error);
  });

  it('has name "InvalidTickerError"', () => {
    expect(new InvalidTickerError('FAKE').name).toBe('InvalidTickerError');
  });

  it('stores the ticker on the .ticker property', () => {
    expect(new InvalidTickerError('FAKE').ticker).toBe('FAKE');
  });

  it('message references the ticker', () => {
    expect(new InvalidTickerError('FAKE').message).toContain('FAKE');
  });

  it('can be caught as an Error', () => {
    expect(() => {
      throw new InvalidTickerError('FAKE');
    }).toThrow(Error);
  });

  it('can be caught by its specific type', () => {
    expect(() => {
      throw new InvalidTickerError('FAKE');
    }).toThrow(InvalidTickerError);
  });

  it('is distinguishable from ApiError via instanceof', () => {
    const err = new InvalidTickerError('FAKE');
    expect(err instanceof ApiError).toBe(false);
    expect(err instanceof InvalidTickerError).toBe(true);
  });
});

describe('DataProcessingError', () => {
  it('is an instance of Error', () => {
    expect(new DataProcessingError('bad data')).toBeInstanceOf(Error);
  });

  it('has name "DataProcessingError"', () => {
    expect(new DataProcessingError('bad data').name).toBe('DataProcessingError');
  });

  it('stores the message', () => {
    expect(new DataProcessingError('missing field "eps"').message).toBe('missing field "eps"');
  });

  it('can be caught as an Error', () => {
    expect(() => {
      throw new DataProcessingError('bad data');
    }).toThrow(Error);
  });

  it('can be caught by its specific type', () => {
    expect(() => {
      throw new DataProcessingError('bad data');
    }).toThrow(DataProcessingError);
  });

  it('is distinguishable from ApiError and InvalidTickerError', () => {
    const err = new DataProcessingError('bad data');
    expect(err instanceof ApiError).toBe(false);
    expect(err instanceof InvalidTickerError).toBe(false);
    expect(err instanceof DataProcessingError).toBe(true);
  });
});

describe('Error type discrimination (instanceof pattern used in App.tsx)', () => {
  const classify = (err: unknown): string => {
    if (err instanceof InvalidTickerError) return 'invalid-ticker';
    if (err instanceof ApiError) return 'api-error';
    if (err instanceof DataProcessingError) return 'data-error';
    return 'unknown';
  };

  it('correctly classifies InvalidTickerError', () => {
    expect(classify(new InvalidTickerError('FAKE'))).toBe('invalid-ticker');
  });

  it('correctly classifies ApiError', () => {
    expect(classify(new ApiError('down'))).toBe('api-error');
  });

  it('correctly classifies DataProcessingError', () => {
    expect(classify(new DataProcessingError('bad json'))).toBe('data-error');
  });

  it('returns "unknown" for plain Error', () => {
    expect(classify(new Error('generic'))).toBe('unknown');
  });

  it('returns "unknown" for non-Error values', () => {
    expect(classify('string error')).toBe('unknown');
    expect(classify(42)).toBe('unknown');
    expect(classify(null)).toBe('unknown');
  });
});
