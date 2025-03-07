# GitHub Actions Workflow: Website Deployment

This GitHub Actions workflow is designed to automate the deployment of a website. The workflow is triggered by a push event to the `main` branch and interacts with AWS services, including assuming an IAM role and triggering an AWS CodePipeline execution.

## Workflow Overview

- **Trigger**: The workflow is triggered by a push to the `main` branch.
- **AWS Integration**: The workflow integrates with AWS using the `aws-actions/configure-aws-credentials` GitHub Action to configure AWS credentials and assume an IAM role for deployment.
- **Deployment**: The workflow triggers an AWS CodePipeline execution for the website deployment.

## Trigger

The workflow is triggered when there is a push event to the `main` branch.

```yaml
on:
  push:
    branches:
      - main
```
## Environment Variables

The following environment variables are defined for the workflow:

    AWS_REGION: Specifies the AWS region where the deployment will take place. This variable should be defined as vars.AWS_REGION in the repository's configuration.

## Permissions

The workflow defines the following permissions:

    id-token: write: This permission allows the workflow to write an ID token, which is necessary for federated authentication with AWS.
    contents: read: This permission enables the workflow to read the repository's contents, such as source code and configuration files.

## IAM Policy for AWS CodePipeline Trigger

To allow the workflow to trigger the CodePipeline execution, an IAM policy needs to be created and attached to the IAM role being assumed. The policy should grant permission for the codepipeline:StartPipelineExecution and codepipeline:GetPipelineState actions for the specific CodePipeline resource.

Here is an example IAM policy:

```json
{
    "Statement": [
        {
            "Action": [
                "codepipeline:StartPipelineExecution",
                "codepipeline:GetPipelineState"
            ],
            "Effect": "Allow",
            "Resource": "arn:aws:codepipeline:${AWS_REGION}:${PROD_AWS_ACCOUNT_ID}:ci-cd-website-prod-pipeline"
        }
    ],
    "Version": "2012-10-17"
}
```

Here is an example Trust relationships:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringLike": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:*"
                }
            }
        }
    ]
}
```

## Jobs

1. Deploy Job

The deploy job handles the deployment of the website. It runs on the ubuntu-latest GitHub-hosted runner and consists of the following steps:
Steps

Checkout Code
This step checks out the repository's code to the GitHub runner so that subsequent steps can access it.

```yaml
- name: Checkout code
  uses: actions/checkout@v4
```

2. Configure AWS Credentials

This step configures the AWS credentials using the aws-actions/configure-aws-credentials GitHub Action. It assumes a specific IAM role (website-deploy-trigger-role) that grants permission to trigger the AWS CodePipeline. The role-to-assume and role-session-name are specified, and the AWS region is passed from the environment variables.

```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::${{ vars.PROD_AWS_ACCOUNT_ID }}:role/website-deploy-trigger-role
    role-session-name: GitHub_to_AWS_via_FederatedOIDC
    aws-region: ${{ env.AWS_REGION }}
```

3. Trigger CodePipeline

This step triggers the execution of the AWS CodePipeline named ci-cd-website-prod-pipeline, which handles the deployment process in AWS.

```yaml
- name: Trigger CodePipeline
  run: |
    aws codepipeline start-pipeline-execution --name ci-cd-website-prod-pipeline
```

## Security Best Practices for Managing Repository

1. Use Least Privilege for IAM Roles

When creating IAM roles for workflows, always apply the principle of least privilege. Only grant the permissions necessary for the task. For example, only grant codepipeline:StartPipelineExecution and codepipeline:GetPipelineState permissions for triggering the pipeline, instead of full access to CodePipeline.

Refer to the example IAM policy provided earlier to restrict access to only the required CodePipeline resource.

2. Monitor Variable Usage

Regularly review repository access and the usage of variables. GitHub provides detailed audit logs to track which workflows interact with your variables, helping you detect and prevent unauthorized access.

## Monitoring and Logging Recommendations

1. GitHub Actions Logs

GitHub Actions automatically generates detailed logs for each step of a workflow run. These logs include important information about the status of each action, any errors that occurred, and debugging information.

- Accessing Logs: To view logs for a workflow run, navigate to the Actions tab in your GitHub repository, select the workflow run, and view the logs for each step.
- Log Level: Ensure that the logging level is appropriate for your needs. You may choose to log detailed output for debugging during development  and more limited output for production.
- Redacting Secrets: GitHub Actions automatically redacts secrets from logs to prevent accidental exposure of sensitive data, but ensure that no sensitive data is printed manually.

2. AWS CodePipeline Logs

AWS CodePipeline integrates with Amazon CloudWatch for logging, providing detailed logs for each stage of the pipeline. These logs are valuable for monitoring and debugging pipeline executions.

- Enable CloudWatch Logs: Ensure that CloudWatch logging is enabled for each pipeline stage in your AWS CodePipeline. This allows you to view logs for actions like CodeBuild, Lambda functions, and other AWS services.
- Viewing Logs: You can view the logs in the CloudWatch console by navigating to Logs > Log Groups > /aws/codepipeline/ followed by the name of your pipeline.
- CodeBuild Logs: If you're using AWS CodeBuild for build stages, ensure that the buildspec file includes commands to log important output, especially error messages and status updates.

## Notes

- Ensure that the IAM role (website-deploy-trigger-role) is correctly configured with the necessary permissions to trigger the AWS CodePipeline.
- The vars.PROD_AWS_ACCOUNT_ID variable should be set up in the repository to contain the appropriate AWS account ID for the production environment.
- The ci-cd-website-prod-pipeline CodePipeline should be created and configured in the specified AWS region.
