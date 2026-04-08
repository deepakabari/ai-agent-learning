resource "aws_ssm_parameter" "google_api_key" {
  name        = "/ai-agent/google-api-key"
  description = "Google Gemini API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_IN_AWS_CONSOLE" # Initial placeholder value

  # Instruct Terraform to ignore future changes to this value made manually in the AWS Console
  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "groq_api_key" {
  name        = "/ai-agent/groq-api-key"
  description = "Groq Llama API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_IN_AWS_CONSOLE" # Initial placeholder value

  lifecycle {
    ignore_changes = [value]
  }
}
