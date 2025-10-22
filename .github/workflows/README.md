# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the 7hand Card Game project.

## Workflows

### CI Workflows

- **backend-ci.yml** - Tests the Node.js/Express backend with PostgreSQL
- **front-end-ci.yml** - Builds and tests the Angular frontend
- **selenium-ci.yml** - Runs multi-browser Selenium tests

### Automation Workflows

- **auto-merge-dependabot.yml** - Automatically merges Dependabot PRs
- **auto-delete-branch.yml** - Automatically deletes branches after PR merge

### Publishing Workflows

#### aws-publish.yml - AWS ECR Publishing

Automatically builds and publishes Docker images to AWS ECR (Elastic Container Registry) when changes are pushed to the `main` branch.

**Components Published:**
- Frontend (Angular app)
- Backend (Node.js/Express API)
- Server (Go WebSocket server with GameLift integration)

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Requirements:**

The workflow requires the following GitHub secrets to be configured:

1. **AWS_ROLE_ARN** - ARN of the IAM role to assume for AWS access (using OIDC)
   - Example: `arn:aws:iam::123456789012:role/GitHubActionsRole`
   - The role should have permissions to push to ECR

2. **AWS_REGION** - AWS region where ECR repositories are located
   - Example: `us-east-1`

**ECR Repository Naming:**

The workflow expects the following ECR repositories to exist in your AWS account:
- `7hand-frontend` - For Angular frontend images
- `7hand-backend` - For Node.js backend images
- `7hand-server` - For Go server images

**Image Tags:**

Each build creates two tags:
- `<git-sha>` - Specific commit SHA for versioning
- `latest` - Always points to the most recent build

**Setting up AWS Access:**

1. Create ECR repositories in AWS:
   ```bash
   aws ecr create-repository --repository-name 7hand-frontend --region us-east-1
   aws ecr create-repository --repository-name 7hand-backend --region us-east-1
   aws ecr create-repository --repository-name 7hand-server --region us-east-1
   ```

2. Create an IAM role for GitHub Actions with ECR push permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:BatchCheckLayerAvailability",
           "ecr:GetDownloadUrlForLayer",
           "ecr:BatchGetImage",
           "ecr:PutImage",
           "ecr:InitiateLayerUpload",
           "ecr:UploadLayerPart",
           "ecr:CompleteLayerUpload"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

3. Configure the role's trust relationship to allow GitHub OIDC:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:FlaccidFacade/7hand:ref:refs/heads/main"
           }
         }
       }
     ]
   }
   ```

4. Add the secrets to your GitHub repository:
   - Go to Repository Settings → Secrets and variables → Actions
   - Add `AWS_ROLE_ARN` with your role ARN
   - Add `AWS_REGION` with your AWS region

**Deployment:**

After images are published to ECR, you can deploy them to:
- Amazon ECS (Elastic Container Service)
- Amazon EKS (Elastic Kubernetes Service)
- AWS GameLift Anywhere (for the Go server component)
- Any Docker-compatible container orchestration platform

**Image URIs:**

After a successful build, image URIs will be in the format:
```
<account-id>.dkr.ecr.<region>.amazonaws.com/7hand-frontend:<git-sha>
<account-id>.dkr.ecr.<region>.amazonaws.com/7hand-backend:<git-sha>
<account-id>.dkr.ecr.<region>.amazonaws.com/7hand-server:<git-sha>
```

These URIs are output as workflow notices and can be used in deployment configurations.

### Auto-Delete Branch Workflow

#### auto-delete-branch.yml - Automatic Branch Cleanup

Automatically deletes feature branches after their pull requests are merged, helping keep the repository clean and organized.

**Triggers:**
- Pull request closed events (only when merged)

**Behavior:**
- Deletes the source branch when a PR is successfully merged
- Skips deletion for protected branches: `main`, `master`, `develop`, `staging`, `production`
- Skips deletion for branches from forked repositories
- Fails gracefully if branch deletion encounters an error

**Permissions Required:**
- `contents: write` - To delete branches
- `pull-requests: read` - To read PR information

**Why Use This:**
- Automatically cleans up feature branches after merge
- Reduces repository clutter
- No manual cleanup needed for merged branches
- Maintains important branches (main, develop, etc.)

**Note:** This workflow only runs when a PR is merged, not when it's simply closed without merging.
