pipeline {
  agent {
    docker {
      image 'docker:28-dind'
      args '--privileged -v /var/run/docker.sock:/var/run/docker.sock'
      label 'docker-agent'
      reuseNode true
    }
  }

  environment {
    AWS_REGION      = 'ap-south-1'
    ECR_REGISTRY    = '312320186237.dkr.ecr.ap-south-1.amazonaws.com'
    ECR_REPO        = 'bharatgpt-mini'
    IMAGE_TAG       = "${BUILD_NUMBER}"
    APP_EC2_IP      = '35.154.19.140'
    APP_EC2_USER    = 'ubuntu'
  }

  stages {

    stage('Checkout') {
      steps {
        echo '📥 Pulling code from GitHub...'
        checkout scm
      }
    }

    stage('Build Docker Image') {
      steps {
        echo '🔨 Building Docker image...'
        sh '''
          docker build -t $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPO:latest
        '''
      }
    }

    stage('Test') {
      steps {
        echo '🧪 Running tests...'
        sh '''
          docker run --rm -d --name test-app -p 3001:3000 $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG
          sleep 5
          docker exec test-app wget -qO- http://localhost:3000/health || exit 1
          docker stop test-app
          echo "✅ Health check passed!"
        '''
      }
    }

    stage('Push to ECR') {
      steps {
        echo '📤 Pushing image to Amazon ECR...'
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-credentials'
        ]]) {
          sh '''
            apk add --no-cache aws-cli || true
            aws ecr get-login-password --region $AWS_REGION | \
              docker login --username AWS --password-stdin $ECR_REGISTRY
            docker push $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG
            docker push $ECR_REGISTRY/$ECR_REPO:latest
          '''
        }
      }
    }

    stage('Deploy to EC2') {
      steps {
        echo '🚀 Deploying to App EC2...'
        withCredentials([
          sshUserPrivateKey(credentialsId: 'app-ec2-ssh', keyFileVariable: 'SSH_KEY'),
          [$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials']
        ]) {
          sh '''
            apk add --no-cache openssh-client || true
            export AWS_ECR_PASSWORD=$(aws ecr get-login-password --region $AWS_REGION)

            ssh -o StrictHostKeyChecking=no -i $SSH_KEY $APP_EC2_USER@$APP_EC2_IP << ENDSSH
              # Login to ECR
              echo "$AWS_ECR_PASSWORD" | docker login --username AWS --password-stdin $ECR_REGISTRY

              # Pull latest image
              docker pull $ECR_REGISTRY/$ECR_REPO:latest

              # Stop and remove old container
              docker stop bharatgpt-mini || true
              docker rm bharatgpt-mini || true

              # Run new container
              docker run -d \
                --name bharatgpt-mini \
                --restart always \
                -p 80:3000 \
                $ECR_REGISTRY/$ECR_REPO:latest

              echo "✅ App deployed successfully!"
ENDSSH
          '''
        }
      }
    }

  }

  post {
    success {
      echo '🎉 Pipeline succeeded! BharatGPT Mini is live at http://35.154.19.140'
    }
    failure {
      echo '❌ Pipeline failed! Check the logs above.'
    }
    always {
      sh 'docker rmi $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG || true'
    }
  }
}
