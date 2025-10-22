/**
 * Custom error for failures during the API call itself (e.g., network issues, server errors).
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Custom error for when the requested stock ticker is not valid or not found.
 */
export class InvalidTickerError extends Error {
  public ticker: string;
  constructor(ticker: string) {
    super(`Invalid ticker provided: ${ticker}`);
    this.name = 'InvalidTickerError';
    this.ticker = ticker;
  }
}

/**
 * Custom error for when the API response is malformed, missing data, or fails validation.
 */
export class DataProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataProcessingError';
  }
}
