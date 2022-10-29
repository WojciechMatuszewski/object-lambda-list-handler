# S3 Object List via the S3 Object Lambda

[Blog post](https://aws.amazon.com/about-aws/whats-new/2022/10/amazon-s3-object-lambda-code-modify-results-s3-head-list-api-requests/).

## Learnings

- The `AWS::Lambda::Permission` should not be confused with the IAM rules for the function execution role.

  - The `AWS::Lambda::Permission` is a **separate resource** which could grant **an AWS service or other AWS account the ability to use a given function**.

    - I could not find a direct answer, but my guess is they implemented it as a separate resource to avoid loops in CFN definitions.

- Interestingly, there is no `s3:ListObjects` permission, only the `s3:ListBucket` one.

  - The resource has to be the whole bucket, **you do the filtering via the `Conditions` block – the `s3:prefix` condition**.

  - If you use this condition, you must specify the `Prefix` parameter while using the SDK, like so:

    ```ts
      new ListObjectsCommand({
        Bucket: bucketName,
        Prefix: "the prefix"
      })
    ```

- When creating the [_Object Lambda Access Point_](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-s3objectlambda-accesspoint.html) one can provide the `AllowedFeatures`. Then, inside the `TransformationConfigurations`, one must specify `Actions`. What is the difference between those two?

  - When specifying values for the `Actions` array, there is the `ListObjects` and `ListObjectV2`. The [latter seem to have more features](https://stackoverflow.com/questions/37534077/what-is-the-difference-between-boto3-list-objects-and-list-objects-v2).

    - The choice is important, as the [AWS documentation example](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-usage-examples.html#list-object-ap) uses the `list-objects-v2` CLI command for listing via the Access Point. If you do not specify the `ListObjectsV2` in the `Actions` array, the command will not go through the Object Lambda.

- When it comes to permissions, I'm very surprised that I do not have to specify an IAM resource policy to allow S3 to invoke my Lambda Function.

  - If the S3 command causes the Object Lambda invocation, the **caller role has to have the `lambda:Invoke` function permissions**.

- It is important to understand that the AWS Lambda uses a presigned URL to call and retrieve the data from the S3.

  - This means that, in our example, if the caller of the `list-objects` call has permissions to list objects, the Object Lambda **does not have to have that permissions**.

- I had a lot of issues finding the API, what to return from the Object Lambda. It would be neat if they included the example in the feature launch blog post.

  - You can find [the example here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html#olap-listobjects).

- Depending on the operation, the call you make to S3 will either go through the Object Lambda access point or the _supporting access point_.

  - For example, if I have an Object Lambda set up for the `ListBucket` operation, but use the `GetObject` operation and provide the Object Lambda arn, the Object Lambda will NOT be invoked.

- To invoke the S3 request using the SDK via the access point, I had to provide the `s3:ListBucket`, `s3-object-lambda:ListBucket` and `lambda:InvokeFunction` permission to the AWS Lambda execution role.

  - It the call to S3 did not result in the Object Lambda invocation, I did not need the `lambda:InvokeFunction`.

  - It is a bit suboptimal that I have to have the `s3-object-lambda:ListBucket` permissions. Can I remove it?

    - I'm afraid that is not the case. [Here is an example from AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-policies.html) (scroll at the bottom). The last IAM policy contains the `s3-object-lambda` permission.

      - Of course, the example policy is very liberal with a lot of `*`. I'm not sure it is a good idea to follow it as given.

    - While I kind of understand why I have to use the `s3-object-lambda:ListBucket` permission, **I do not understand why I do also need the `s3:ListBucket` on the _supporting access point_**.

      - It is **[explained in the documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-security.html)**

        > When Lambda is invoked for a request S3 generates a presigned URL to your object on your behalf through the supporting access point. Your Lambda function receives this URL as input when the function is invoked.

- It is **crucial to handle errors correctly in the Object Lambda**.

  - While using the presigned URL, you have to parse the XML response and check if the response does not contain errors. The presigned URL fetch will succeed, but the response contains an error message.
