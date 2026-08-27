export class RedirectConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "RedirectConfigError";
  }
}

export function isThrottlingError(error) {
  return [
    "ProvisionedThroughputExceededException",
    "RequestLimitExceeded",
    "ThrottlingException"
  ].includes(error?.name);
}
