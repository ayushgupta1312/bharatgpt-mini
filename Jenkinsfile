pipeline {
  agent any

  options {
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '5'))
    disableConcurrentBuilds()
  }

  environment {
    AWS_REGION      = 'ap-south-1'
    ECR_REGISTRY    = '312320186237.dkr.ecr.ap-south-1.amazonaws.com'
    ECR_REPO        = 'bharatgpt-mini'
    IMAGE_TAG       = "v${BUILD_NUMBER}"
    FULL_IMAGE_NAME = "${ECR_REGISTRY}/${ECR_REPO}:v${BUILD_NUMBER}"
    APP_EC2_IP      = '3.108.59.160'
    APP_EC2_USER    = 'ubuntu'
  }

  stages {

    stage('Checkout') {
      steps {
        echo "📥 Checking out code..."
        checkout scm
        sh 'git log -1 --pretty=format:"%h - %an: %s"'
      }
    }

    stage('Build Docker Image') {
      steps {
        echo "🔨 Building Docker image: ${FULL_IMAGE_NAME}"
        sh '''
          docker build \
            -t $FULL_IMAGE_NAME \
            -t $ECR_REGISTRY/$ECR_REPO:latest \
            .
          echo "✅ Image built: $FULL_IMAGE_NAME"
        '''
      }
    }

    stage('Test') {
      steps {
        echo "🧪 Running tests..."
        sh '''
          docker stop test-app || true
          docker rm test-app || true

          docker run -d --name test-app $FULL_IMAGE_NAME
          sleep 5

          CONTAINER_IP=$(docker inspect -f \
            '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
            test-app)
          echo "Container IP: $CONTAINER_IP"

          curl -f http://$CONTAINER_IP:3000/health || exit 1
          echo "✅ Health check passed!"

          curl -f -X POST http://$CONTAINER_IP:3000/ask \
            -H "Content-Type: application/json" \
            -d '{"question":"test","mode":"yoga"}' || exit 1
          echo "✅ API test passed!"

          docker stop test-app
          docker rm test-app
        '''
      }
      post {
        failure {
          sh 'docker stop test-app || true && docker rm test-app || true'
        }
      }
    }

    stage('Push to ECR') {
      steps {
        echo "📤 Pushing to ECR: ${FULL_IMAGE_NAME}"
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-credentials'
        ]]) {
          sh '''
            aws ecr get-login-password --region $AWS_REGION | \
              docker login --username AWS --password-stdin $ECR_REGISTRY

            docker push $FULL_IMAGE_NAME
            docker push $ECR_REGISTRY/$ECR_REPO:latest

            echo "✅ Pushed: $FULL_IMAGE_NAME"
          '''
        }
      }
    }

    stage('Deploy to EC2') {
      steps {
        echo "🚀 Deploying ${FULL_IMAGE_NAME} to App EC2..."
        withCredentials([
          sshUserPrivateKey(
            credentialsId: 'app-ec2-ssh',
            keyFileVariable: 'SSH_KEY'
          )
        ]) {
          sh '''
            chmod 400 $SSH_KEY
            ssh -o StrictHostKeyChecking=no \
                -o ConnectTimeout=10 \
                -i $SSH_KEY \
                $APP_EC2_USER@$APP_EC2_IP "

              aws ecr get-login-password --region ap-south-1 | \
                docker login --username AWS \
                --password-stdin $ECR_REGISTRY

              docker pull $FULL_IMAGE_NAME

              docker stop bharatgpt-mini || true
              docker rm bharatgpt-mini || true

              docker run -d \
                --name bharatgpt-mini \
                --restart always \
                -p 80:3000 \
                --memory 256m \
                --cpus 0.5 \
                $FULL_IMAGE_NAME

              sleep 5
              curl -f http://localhost/health || exit 1
              docker image prune -f

              echo '✅ Deployed: $FULL_IMAGE_NAME'
            "
          '''
        }
      }
    }
  }

  post {
    success {
      echo """
      ╔══════════════════════════════════════╗
      ║   ✅ PIPELINE SUCCEEDED!             ║
      ║   Image: ${IMAGE_TAG}                ║
      ║   App:   http://${APP_EC2_IP}        ║
      ╚══════════════════════════════════════╝
      """
    }
    failure {
      echo """
      ╔══════════════════════════════════════╗
      ║   ❌ PIPELINE FAILED!                ║
      ║   Build: #${BUILD_NUMBER}            ║
      ╚══════════════════════════════════════╝
      """
    }
    always {
      sh '''
        docker rmi $FULL_IMAGE_NAME || true
        docker rmi $ECR_REGISTRY/$ECR_REPO:latest || true
        docker image prune -f || true
      '''
    }
  }
}
