# Documentation for GitHub Actions Pipelines: Sandbox Creation, Sandbox Deletion and Website Deploy

This documentation provides an overview of two GitHub Actions workflows used for managing AWS CodePipeline executions: Sandbox Creation and Sandbox Deletion. It includes instructions on the required secrets and how to add them to your GitHub repository.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Workflow 1: Sandbox Creation](#workflow-1-sandbox-creation)
   - [Creation Overview](#creation-overview)
   - [Creation Required Secrets](#creation-required-secrets)
   - [Creation Secrets Setup](#creation-secrets-setup)
- [Workflow 2: Trigger Sandbox Deletion](#workflow-2-trigger-sandbox-deletion)
   - [Deletion Overview](#deletion-overview)
   - [Deletion Required Secrets](#deletion-required-secrets)
   - [Deletion Secrets Setup](#deletion-secrets-setup)
- [AWS IAM Role Configuration](#aws-iam-role-configuration)
- [Additional Notes](#additional-notes)

## Introduction

The two GitHub Actions workflows automate the process of triggering AWS CodePipeline executions in response to GitHub events. They utilize GitHub's OpenID Connect (OIDC) feature for secure authentication with AWS, eliminating the need for long-lived AWS credentials.

   Sandbox Management: Handles the creation and updating of sandbox environments when pull requests are opened or when code is pushed (excluding the main branch).
   Trigger Sandbox Deletion: Initiates the deletion of sandbox environments when a pull request is closed on the main branch.

## Prerequisites

   GitHub Repository: Access to the repository where the workflows will be used.
   AWS Account: Permissions to create and manage AWS IAM roles and policies.
   AWS CodePipeline: Existing pipelines for sandbox creation and deletion.
   GitHub Secrets: Ability to add secrets to the repository.

## Workflow 1: Sandbox Creation
### Creation Overview

Filename: .github/workflows/sandbox-creation.yml

This workflow triggers the AWS CodePipeline responsible for creating or updating sandbox environments. It responds to two GitHub events:

   Pull Request Opened: When a pull request is opened, it starts the pipeline with the pull request number.
   Push: When code is pushed to any branch except main, it starts the pipeline without the pull request number.

Key Features:

   Skips execution on pushes to the main branch.
   Uses OIDC for secure authentication with AWS.
   Validates required secrets before execution.

### Creation Required Secrets

   AWS_CODEPIPELINE_ROLE_ARN: The Amazon Resource Name (ARN) of the AWS IAM role that GitHub Actions will assume to interact with AWS services.

   AWS_SANDBOX_CODEPIPELINE_NAME: The name of the AWS CodePipeline that manages sandbox environments.

### Creation Secrets Setup
1. Add AWS_CODEPIPELINE_ROLE_ARN

    Description: This secret stores the ARN of the IAM role that GitHub Actions will assume via OIDC.
    Steps:
        In your GitHub repository, navigate to Settings > Secrets and variables > Actions > Secrets.
        Click New repository secret.
        Set the Name to AWS_CODEPIPELINE_ROLE_ARN.
        Set the Value to the ARN of your IAM role (e.g., arn:aws:iam::123456789012:role/GitHubActionsRole).
        Click Add secret.

2. Add AWS_SANDBOX_CODEPIPELINE_NAME

    Description: This secret stores the name of the AWS CodePipeline used for sandbox creation.
    Steps:
        In the same Secrets section, click New repository secret.
        Set the Name to AWS_SANDBOX_CODEPIPELINE_NAME.
        Set the Value to the name of your CodePipeline (e.g., sandbox-creation).
        Click Add secret.

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

   Logging and Monitoring:
       Monitor the GitHub Actions logs for any errors or issues.
       Check AWS CodePipeline execution history for pipeline runs initiated by the workflows.