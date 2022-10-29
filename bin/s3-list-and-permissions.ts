#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { S3ListAndPermissionsStack } from "../lib/s3-list-and-permissions-stack";

const app = new cdk.App();
new S3ListAndPermissionsStack(app, "S3ListStuffStack", {
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: "s3lis"
  })
});
