import { S3Client, ListObjectsCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({});

export const handler = async () => {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    return {
      statusCode: 500,
      message: JSON.stringify({ body: "Missing `BUCKET_NAME` variable" })
    };
  }

  try {
    const result = await s3Client.send(
      new ListObjectsCommand({
        Bucket: bucketName,
        Prefix: process.env.S3_PREFIX as string
      })
    );
    const numberOfObjects = result.Contents?.length ?? 0;

    return {
      statusCode: 200,
      message: JSON.stringify({ body: `Fetched ${numberOfObjects} objects` })
    };
  } catch (e) {
    return {
      statusCode: 500,
      message: JSON.stringify({ body: e })
    };
  }
};
