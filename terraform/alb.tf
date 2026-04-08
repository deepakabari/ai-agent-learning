resource "aws_security_group" "alb_sg" {
  name        = "ai-agent-alb-sg"
  description = "Allow HTTP traffic from everywhere"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "main" {
  name               = "ai-agent-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  tags = {
    Name = "ai-agent-alb"
  }
}

resource "aws_lb_target_group" "frontend" {
  name        = "ai-agent-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  deregistration_delay = 60

  health_check {
    path                = "/"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "ai-agent-backend-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  deregistration_delay = 60

  health_check {
    path                = "/healthz"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

