jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
// Without this, config/env.ts's dotenv.config() would refill AWS_ENDPOINT_URL
// from the real local .env file even after the test deletes it below.
jest.mock("dotenv", () => ({ config: jest.fn() }));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, SQS_QUEUE_URL: "http://localhost:4566/000000000000/pentest-jobs" };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("workspace.ts S3 client construction", () => {
  it("sets forcePathStyle when pointed at a custom endpoint (LocalStack) — without it, LocalStack mis-routes bucket/key", () => {
    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";

    // eslint-disable-next-line @typescript-eslint/no-var-requires -- must re-require after jest.resetModules()
    const { S3Client } = require("@aws-sdk/client-s3");
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- re-evaluate workspace.ts against the env set above
    require("../workspace");

    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({ forcePathStyle: true }));
  });

  it("does not force path style against real AWS (no custom endpoint)", () => {
    delete process.env.AWS_ENDPOINT_URL;

    // eslint-disable-next-line @typescript-eslint/no-var-requires -- must re-require after jest.resetModules()
    const { S3Client } = require("@aws-sdk/client-s3");
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- re-evaluate workspace.ts against the env set above
    require("../workspace");

    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({ forcePathStyle: false }));
  });
});
