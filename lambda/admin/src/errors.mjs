export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isThrottlingError(error) {
  return [
    "ProvisionedThroughputExceededException",
    "RequestLimitExceeded",
    "ThrottlingException"
  ].includes(error?.name);
}
