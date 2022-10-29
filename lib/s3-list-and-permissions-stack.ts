import * as cdk from "aws-cdk-lib";
import { CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

export class S3ListAndPermissionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new cdk.aws_s3.Bucket(this, "Bucket", {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: cdk.aws_s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
    });

    const s3Prefix = "projects";
    const regularListHandler = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "RegularList",
      {
        entry: join(__dirname, "./s3-regular-list-handler.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: bucket.bucketName,
          S3_PREFIX: s3Prefix
        }
      }
    );

    regularListHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["s3:ListBucket"],
        resources: [bucket.bucketArn],
        conditions: {
          StringEquals: {
            "s3:prefix": s3Prefix
          }
        }
      })
    );

    const supportingAccessPoint = new cdk.aws_s3.CfnAccessPoint(
      this,
      "S3AccessPoint",
      {
        bucket: bucket.bucketName
      }
    );

    const accessPointListHandler = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "AccessPointList",
      {
        entry: join(__dirname, "./s3-access-point-list-handler.ts"),
        handler: "handler",
        environment: {}
      }
    );

    const objectLambdaAccessPoint = new cdk.aws_s3objectlambda.CfnAccessPoint(
      this,
      "ListObjectLambdaAccessPoint",
      {
        objectLambdaConfiguration: {
          transformationConfigurations: [
            {
              /**
               * What is the difference between this actions and `allowedFeatures`?
               */
              actions: ["ListObjects"],
              contentTransformation: {
                AwsLambda: { FunctionArn: accessPointListHandler.functionArn }
              }
            }
          ],
          allowedFeatures: [],
          cloudWatchMetricsEnabled: false,
          supportingAccessPoint: supportingAccessPoint.attrArn
        }
      }
    );

    new CfnOutput(this, "AccessPointArn", {
      value: objectLambdaAccessPoint.attrArn
    });

    const listThroughAccessPointHandler =
      new cdk.aws_lambda_nodejs.NodejsFunction(
        this,
        "throughAccessPointHandler",
        {
          entry: join(__dirname, "./s3-list-through-access-point-handler.ts"),
          handler: "handler",
          environment: {
            BUCKET_NAME: objectLambdaAccessPoint.attrArn
          }
        }
      );

    listThroughAccessPointHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: "AllowS3ListBucket",
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["s3:ListBucket"],
        resources: [bucket.bucketArn, supportingAccessPoint.attrArn]
      })
    );

    listThroughAccessPointHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: "AllowObjectLambdaFunctionInvoke",
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [accessPointListHandler.functionArn],
        conditions: {
          "ForAnyValue:StringEquals": {
            "aws:CalledVia": ["s3-object-lambda.amazonaws.com"]
          }
        }
      })
    );

    listThroughAccessPointHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: "AllowObjectLambdaListBucket",
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["s3-object-lambda:*"],
        resources: [objectLambdaAccessPoint.attrArn]
      })
    );
  }
}
