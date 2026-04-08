# ECS Task Execution Role (for pulling images, logging, and reading secrets)
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "ai-agent-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Inline policy to read SSM variables
resource "aws_iam_role_policy" "ecs_task_execution_ssm_policy" {
  name = "ai-agent-ecs-execution-ssm"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "kms:Decrypt"
        ]
        Resource = [
          aws_ssm_parameter.google_api_key.arn
        ]
      }
    ]
  })
}

# ECS Task Role (for the app itself to access DynamoDB, etc.)
resource "aws_iam_role" "ecs_task_role" {
  name = "ai-agent-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# Inline policy for DynamoDB access
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "ai-agent-dynamodb-access"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable",
          "dynamodb:CreateTable"
        ]
        Effect   = "Allow"
        Resource = "*" # Restrict this to your table ARN for better security later
      }
    ]
  })
}
