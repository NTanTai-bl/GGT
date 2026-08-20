import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { getPentestOrThrow } from "./pentest.service";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  forcePathStyle: Boolean(env.AWS_ENDPOINT_URL),
});

export interface RunArtifactSummary {
  key: string;
  filename: string;
  sizeBytes: number;
  lastModified: string | null;
  downloadUrl: string;
}

/** Lists the S3 objects under <run-id>/ and returns short-lived presigned download links — never raw bytes through the API. */
export async function listRunArtifacts(runId: string): Promise<RunArtifactSummary[]> {
  await getPentestOrThrow(runId);

  const prefix = `${runId}/`;
  const listing = await s3Client.send(
    new ListObjectsV2Command({ Bucket: env.S3_ARTIFACTS_BUCKET, Prefix: prefix })
  );

  const objects = listing.Contents ?? [];
  return Promise.all(
    objects
      .filter((obj) => obj.Key)
      .map(async (obj) => {
        const key = obj.Key as string;
        const downloadUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: env.S3_ARTIFACTS_BUCKET, Key: key }),
          { expiresIn: 300 }
        );
        return {
          key,
          filename: key.slice(prefix.length),
          sizeBytes: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? null,
          downloadUrl,
        };
      })
  );
}
