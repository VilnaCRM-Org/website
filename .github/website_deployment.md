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

## Notes

- Ensure that the IAM role (website-deploy-trigger-role) is correctly configured with the necessary permissions to trigger the AWS CodePipeline.
- The vars.PROD_AWS_ACCOUNT_ID variable should be set up in the repository to contain the appropriate AWS account ID for the production environment.
- The ci-cd-website-prod-pipeline CodePipeline should be created and configured in the specified AWS region.