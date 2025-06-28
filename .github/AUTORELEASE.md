# Autorelease action

## Overview
Auto-release workflows automate the process of creating software releases in response to specific triggers like merging a pull request or pushing to a certain branch. This automation helps streamline the development process, reduce human error, and ensure consistent release practices. In this project, we utilize conventional commits and GitHub Actions to implement our auto-release workflow. Conventional commits provide a standardized format for commit messages, which our GitHub Action uses to automatically determine version bumps and generate changelogs. This combination allows for seamless and consistent releases based on the commit history.

---
## Why You Might Need Auto-Release
Consistency: Automating the release process ensures that every release adheres to predefined standards and procedures, reducing the risk of human error and inconsistency in the release quality.

Efficiency: By automating the changelog generation and release process, teams can save time and focus on development and testing rather than on the operational details of creating a release.

Integration: Auto-release workflows can be integrated with other tools and workflows, such as continuous integration (CI) systems, to ensure that releases are made only when all tests pass, maintaining the quality of the code in the production.

Traceability: Automated releases include detailed logs and changelogs, providing a clear audit trail for changes, which is beneficial for debugging and understanding the projectвЂ™s history.

Speed: Automation speeds up the process of releasing and deploying software, which is especially crucial in high-paced agile environments where multiple releases might occur in a single day.

---
## Setting Up an Auto-Release Workflow
### Step-by-Step Guide
#### 1) The GitHub App configuration

Let's start by creating and configuring a GitHub App:

1. Go to Settings > Developer Settings > GitHub Apps (Developer Settings is at the bottom of the Settings page).
2. Click on New GitHub App.
3. When configuring the new GitHub app, ensure the following:
   a. Complete the necessary details for the application.
   b. Uncheck the active webhook.
   c. Set the following Repository Permissions:
    - Administration: Read and Write (needed for managing repository settings)
    - Contents: Read and Write (needed for accessing and modifying repository contents)
    - Issues: Read and Write (needed for creating and managing issues)
    - Metadata: Read Only (needed for accessing repository metadata)
    - Pull Requests: Read and Write (needed for creating and managing pull requests)
      d. Check "Install Only on this account".

These settings ensure that the GitHub App has the necessary permissions to automate the release process effectively.

Once you have created the app, you need to install it on the repository you want to use it. Follow GitHub's guide on installing your apps to repositories you own.
One more thing you need to do from the app's settings. Go to the app's settings and generate a new private key. Copy that private key to a safe place and then copy the app ID. You will need both values as repository secrets.
You can easily find ID here(Settings > Application > configure your github APP > app settings > you can see app id). Generate a new private key and copy the app ID. These will be used to authenticate the GitHub Actions workflow with the necessary permissions to perform auto-releases.
#### 2) The GitHub repository configuration
Go to Settings > Secrets and Variables > Actions to create new secrets. Add one secret for the private key(VILNACRM_APP_PRIVATE_KEY) and another for the app ID(VILNACRM_APP_ID).
#### 3) Allow force push
To configure the repository branch protection rules, go to Settings > Branches.
Check the option to Allow force pushes and specify that the only allowed actor is the GitHub app you already installed.
