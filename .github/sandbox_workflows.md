# Documentation for GitHub Actions Pipelines: Sandbox Creation, Sandbox Deletion and Website Deploy

This documentation provides an overview of three GitHub Actions workflows used for managing AWS CodePipeline executions: Sandbox Creation, Sandbox Deletion, and Website Deploy. It includes instructions on the required secrets and how to add them to your GitHub repository.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Workflow 1: Sandbox Creation](#workflow-1-sandbox-creation)
  - [Creation and Rebuild Overview](#creation-overview)
  - [Creation Required Secrets](#creation-required-secrets)
  - [Creation Secrets Setup](#creation-secrets-setup)
- [Workflow 2: Trigger Sandbox Deletion](#workflow-2-trigger-sandbox-deletion)
  - [Deletion Overview](#deletion-overview)
  - [Deletion Required Secrets](#deletion-required-secrets)
  - [Deletion Secrets Setup](#deletion-secrets-setup)
- [Workflow 3: Website Deploy](#workflow-3-deploy-website)
  - [Deploy Website Overview](#deploy-website-overview)
  - [Deploy Website Required Secrets](#deploy-website-required-secrets)
  - [Deploy Website Secrets Setup](#deploy-website-secrets-setup)
- [AWS IAM Role Configuration](#aws-iam-role-configuration)
- [Additional Notes](#additional-notes)

## Introduction

The three GitHub Actions workflows automate the process of triggering AWS CodePipeline executions in response to various GitHub events. They leverage GitHub's OpenID Connect (OIDC) feature for secure authentication with AWS and manage both sandbox and production environments.

   Sandbox Management: Handles the creation and updating of sandbox environments when pull requests are opened or when code is pushed (excluding the main branch).
   Trigger Sandbox Deletion: Initiates the deletion of sandbox environments when a pull request is closed on the main branch.
   Website Deploy: Manages the deployment of the production website when code is pushed to the main branch.

## Prerequisites

    GitHub Repository: Access to the repository where the workflows will be used.
    AWS Account: Permissions to create and manage AWS IAM roles, policies, and AWS CodePipeline pipelines.
    AWS Secrets Manager: Storing and retrieving secrets that might need periodic rotation.
    AWS CodePipeline: Existing pipelines for sandbox creation and deletion, as well as production website deployment.
    GitHub Secrets and Variables: Ability to add and manage repository or organization-level secrets and variables.

## Workflow 1: Sandbox Creation
### Creation and Rebuild Overview

Filename: .github/workflows/sandbox-creation.yml (previously named differently, now updated to Sandbox Creation and Rebuild)

Triggers:

    pull_request: When a pull request is opened, trigger the sandbox creation/update pipeline, passing along the PR number.
    push: When code is pushed to any branch except main, trigger the sandbox pipeline without a PR number.

New Feature: Before starting the pipeline execution, the workflow checks if secrets managed in AWS Secrets Manager need rotation. If rotation is required, it triggers custom GitHub repository dispatch events (rotate_token_test, rotate_token_prod) that can be handled by another workflow to rotate the secrets accordingly.

Key Points:

    Uses OIDC for secure authentication with AWS.
    Validates required secrets.
    Checks secret rotation timing against a defined maximum age (in seconds), triggering rotation if needed.
    Starts AWS CodePipeline execution for sandbox creation or update after handling secret rotation needs.

### Creation Required Secrets

    AWS_CODEPIPELINE_ROLE_ARN: The ARN of the AWS IAM role that GitHub Actions will assume to interact with AWS services.
    AWS_SANDBOX_CODEPIPELINE_NAME: The name of the AWS CodePipeline that manages sandbox creation and updates.
    GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_TEST: The IAM role ARN used for checking and rotating test secrets.
    GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_PROD: The IAM role ARN used for checking and rotating production secrets.
    GITHUB_TOKEN_SECRET_NAME: The name of the secret in AWS Secrets Manager that holds the timestamp (and possibly other details) of the last rotation.
    PAT_WITH_REPO_PERMISSIONS: A Personal Access Token with repo permissions, used to dispatch custom GitHub events to initiate secret rotation workflows.

Additionally, you need to ensure that an AWS_REGION variable is set either at the repository or organization level.

### Creation Secrets Setup
1. AWS_CODEPIPELINE_ROLE_ARN
Stores the IAM Role ARN for assuming AWS credentials via OIDC for the sandbox pipeline execution.

  Name: AWS_CODEPIPELINE_ROLE_ARN
  Value: arn:aws:iam::123456789012:role/GitHubActionsRole

2. AWS_SANDBOX_CODEPIPELINE_NAME
The CodePipeline name for sandbox creation and updates.

  Name: AWS_SANDBOX_CODEPIPELINE_NAME
  Value: sandbox-creation

3. GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_TEST
IAM role ARN for test secret verification and rotation.

  Name: GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_TEST
  Value: arn:aws:iam::123456789012:role/TestSecretRotationRole

4. GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_PROD
IAM role ARN for production secret verification and rotation.

  Name: GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_PROD
  Value: arn:aws:iam::123456789012:role/ProdSecretRotationRole

5. GITHUB_TOKEN_SECRET_NAME
The name of the secret in AWS Secrets Manager storing rotation info.

  Name: GITHUB_TOKEN_SECRET_NAME
  Value: my-github-token-secret

6. PAT_WITH_REPO_PERMISSIONS
A PAT with repo level permissions for dispatching repository events.

  Name: PAT_WITH_REPO_PERMISSIONS
  Value: Your Personal Access Token string

Note: All these secrets should be added under: Settings > Secrets and variables > Actions > New repository secret.

AWS_REGION:
This should be set as a variable (not a secret) under Settings > Secrets and variables > Actions > Variables.

    Name: AWS_REGION
    Value: us-east-1 (or your preferred AWS region)

## Workflow 2: Trigger Sandbox Deletion
### Deletion Overview

Filename: .github/workflows/sandbox-deletion.yml

This workflow triggers the AWS CodePipeline responsible for deleting sandbox environments when a pull request is closed on the main branch.

Key Features:

   Responds only to pull request closures on the main branch.
   Utilizes OIDC for secure authentication with AWS.
   Validates the presence of required secrets and environment variables.

### Deletion Required Secrets

   AWS_CODEPIPELINE_ROLE_ARN: The ARN of the AWS IAM role that GitHub Actions will assume.

   AWS_SANDBOX_DELETION_PIPELINE_NAME: The name of the AWS CodePipeline that handles sandbox deletion.

### Deletion Secrets Setup
1. Ensure AWS_CODEPIPELINE_ROLE_ARN is Set

    Note: If you have already set this secret for the Sandbox Creation workflow, you do not need to add it again.

2. Add AWS_SANDBOX_DELETION_PIPELINE_NAME

    Description: This secret holds the name of the CodePipeline used for sandbox deletion.
    Steps:
        In your repository's Secrets section, click New repository secret.
        Set the Name to AWS_SANDBOX_DELETION_PIPELINE_NAME.
        Set the Value to the name of your deletion pipeline (e.g., sandbox-deletion).
        Click Add secret.

## Workflow 3: Deploy Website
### Deploy Website Overview

Filename: .github/workflows/deploy-website.yml

This workflow triggers the AWS CodePipeline responsible for deploying the production website. It responds to code pushes on the main branch.

Key Features:

  Triggers on main branch pushes.
  Uses OIDC for secure authentication with AWS.
  Validates required secrets and environment variables before execution.

### Deploy Website Required Secrets

  AWS_WEBSITE_ROLE_ARN
  Description: The Amazon Resource Name (ARN) of the AWS IAM role that GitHub Actions will assume to interact with AWS services.

  AWS_WEBSITE_CODEPIPELINE_NAME
  Description: The name of the AWS CodePipeline used for deploying the website.

### Deploy Website Secrets Setup

  1. Add AWS_WEBSITE_ROLE_ARN
    Description:
    This secret stores the ARN of the IAM role that GitHub Actions will assume via OIDC.

  Steps:
      Navigate to your GitHub repository: Settings > Secrets and variables > Actions > Secrets.
      Click New repository secret.
      Set the Name to AWS_WEBSITE_ROLE_ARN.
      Set the Value to the ARN of your IAM role (e.g., arn:aws:iam::123456789012:role/WebsiteDeployRole).
      Click Add secret.

  2. Add AWS_WEBSITE_CODEPIPELINE_NAME
    Description:
    This secret stores the name of the AWS CodePipeline used for deploying the production website.

  Steps:
      In the same Secrets section, click New repository secret.
      Set the Name to AWS_WEBSITE_CODEPIPELINE_NAME.
      Set the Value to the name of your CodePipeline (e.g., ci-cd-website-prod-pipeline).
      Click Add secret.

## AWS IAM Role Configuration

Both workflows rely on an AWS IAM role that GitHub Actions assumes via OIDC to interact with AWS services securely. This role must have the necessary permissions and be configured to trust GitHub's OIDC provider.
Steps to Configure the IAM Role

   Create an IAM Role:
       Go to the AWS IAM console.
       Create a new role with the following settings:
           Trusted Entity: Web identity.
           Identity Provider: token.actions.githubusercontent.com.
           Audience: sts.amazonaws.com.

   Set the Trust Policy:

   Update the role's trust relationship with the following policy, replacing placeholders with your information:

    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
          },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringLike": {
              "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:*"
            },
            "StringEquals": {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
            }
          }
        }
      ]
    }

   Replace:
       YOUR_AWS_ACCOUNT_ID with your AWS account number.
       YOUR_GITHUB_ORG with your GitHub organization or username.
       YOUR_REPO with the repository name.

Attach Policies to the Role:

   Attach policies that grant the necessary permissions:
       For Sandbox Management:
           codepipeline:StartPipelineExecution on the pipeline specified in AWS_SANDBOX_CODEPIPELINE_NAME.
       For Trigger Sandbox Deletion:
           codepipeline:StartPipelineExecution on the pipeline specified in AWS_SANDBOX_DELETION_PIPELINE_NAME.

   Example Policy:

        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": "codepipeline:StartPipelineExecution",
              "Resource": [
                "arn:aws:codepipeline:YOUR_REGION:YOUR_ACCOUNT_ID:AWS_SANDBOX_CODEPIPELINE_NAME",
                "arn:aws:codepipeline:YOUR_REGION:YOUR_ACCOUNT_ID:AWS_SANDBOX_DELETION_PIPELINE_NAME"
              ]
            }
          ]
        }

   Replace:
      YOUR_REGION with your AWS region (e.g., us-east-1).
      YOUR_ACCOUNT_ID with your AWS account number.
      SANDBOX_MANAGEMENT_PIPELINE_NAME and SANDBOX_DELETION_PIPELINE_NAME with your actual pipeline names.

For the updated workflow, ensure that the roles for test and production secret checks (GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_TEST and GITHUB_TOKEN_ROTATION_ROLE_TO_ASSUME_PROD) are configured with appropriate policies to:

    Access the specified secret in AWS Secrets Manager.
    No additional CodePipeline permissions are needed for these roles unless required by other parts of your process.

## Additional Notes

  Environment Variables:
    The workflows use the AWS_REGION environment variable.
    Set this variable in your repository or organization settings under Variables.
        Name: AWS_REGION
        Value: Your AWS region (e.g., us-east-1).

  OIDC Authentication:
    By using OIDC, you enhance security by avoiding long-lived AWS credentials.
    Ensure that the IAM role's trust policy is correctly configured to allow GitHub Actions to assume the role.

  Workflow File Placement:
    Place the workflow files in the .github/workflows/ directory of your repository.
        sandbox-creation.yml for the Sandbox Creation workflow.
        sandbox-deletion.yml for the Trigger Sandbox Deletion workflow.

  Testing:
    After setting up, test the workflows by opening and closing pull requests to verify that the pipelines are triggered correctly.
    After making changes, test by opening a PR to ensure that the workflow checks and triggers rotation as expected, and then starts the pipeline execution.

  Logging and Monitoring:
    Monitor the GitHub Actions logs for any errors or issues.
    Check AWS CodePipeline execution history for pipeline runs initiated by the workflows.
    Check GitHub Actions logs and AWS CodePipeline execution history for troubleshooting.

  Secret Rotation Timing: 
    The workflow uses a MAX_AGE (currently 601200 seconds, ~7 days) to determine if a secret rotation is needed. Adjust this value as required.
  
  Rotation Workflows: 
    The TriggerRotation job dispatches events to another repository (e.g., website-infrastructure) to handle the actual rotation. Ensure that receiving workflows are configured to handle rotate_token_test and rotate_token_prod events.
