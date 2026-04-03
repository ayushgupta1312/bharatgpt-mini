pipeline {
  agent {
    docker {
      image 'jenkins-agent:latest'
      args '-v /var/run/docker.sock:/var/run/docker.sock --user root'
      reuseNode true
    }
  }

  environment {
    AWS_REGION   = 'ap-south-1'
    ECR_REGISTRY = '312320186237.dkr.ecr.ap-south-1.amazonaws.com'
    ECR_REPO     = 'bharatgpt-mini'
    IMAGE_TAG    = "${BUILD_NUMBER}"
    APP_EC2_IP   = '3.108.59.160'
    APP_EC2_USER = 'ubuntu'
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
          docker stop test-app || true
          docker rm test-app || true
          docker run --rm -d --name test-app $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG
          sleep 5
          CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' test-app)
          echo "Container IP: $CONTAINER_IP"
          curl -f http://$CONTAINER_IP:3000/health || exit 1
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
          sshUserPrivateKey(credentialsId: 'app-ec2-ssh', keyFileVariable: 'SSH_KEY')
        ]) {
          sh '''
            chmod 400 $SSH_KEY

            # Copy deploy script to App EC2 and execute
            ssh -o StrictHostKeyChecking=no -i $SSH_KEY $APP_EC2_USER@$APP_EC2_IP "
              aws ecr get-login-password --region ap-south-1 | \
                docker login --username AWS --password-stdin $ECR_REGISTRY &&
              docker pull $ECR_REGISTRY/$ECR_REPO:latest &&
              docker stop bharatgpt-mini || true &&
              docker rm bharatgpt-mini || true &&
              docker run -d \
                --name bharatgpt-mini \
                --restart always \
                -p 80:3000 \
                $ECR_REGISTRY/$ECR_REPO:latest &&
              echo '✅ Deployed!'
            "
          '''
        }
      }
    }
  }

  post {
    success { echo '🎉 Pipeline succeeded! App live at http://3.108.59.160' }
    failure { echo '❌ Pipeline failed! Check logs.' }
  }
}
