pipeline {
  agent any

  // Global timeout — kill pipeline if it runs too long
  options {
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '5'))
    disableConcurrentBuilds()
  }

  environment {
    AWS_REGION      = 'ap-south-1'
    ECR_REGISTRY    = '312320186237.dkr.ecr.ap-south-1.amazonaws.com'
    ECR_REPO        = 'bharatgpt-mini'
    IMAGE_TAG       = "${BUILD_NUMBER}"
    FULL_IMAGE_NAME = "${ECR_REGISTRY}/${ECR_REPO}:${BUILD_NUMBER}"
    APP_EC2_IP      = '3.108.59.160'
    APP_EC2_USER    = 'ubuntu'
  }

  stages {

    stage('Checkout') {
      steps {
        echo "📥 Checking out code..."
        checkout scm
        // Print commit info for traceability
        sh 'git log -1 --pretty=format:"%h - %an: %s"'
      }
    }

    stage('Build Docker Image') {
      steps {
        echo "🔨 Building Docker image: ${FULL_IMAGE_NAME}"
        sh '''
          docker build \
            --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
            --build-arg BUILD_NUMBER=$BUILD_NUMBER \
            -t $FULL_IMAGE_NAME \
            -t $ECR_REGISTRY/$ECR_REPO:latest \
            .
          echo "✅ Image built successfully"
          docker images | grep $ECR_REPO
        '''
      }
    }

    stage('Test') {
      steps {
        echo "🧪 Running tests..."
        sh '''
          # Cleanup any leftover test containers
          docker stop test-app || true
          docker rm test-app || true

          # Run container
          docker run -d --name test-app $FULL_IMAGE_NAME
          sleep 5

          # Get container IP
          CONTAINER_IP=$(docker inspect -f \
            '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
            test-app)
          echo "Container IP: $CONTAINER_IP"

          # Health check test
          curl -f http://$CONTAINER_IP:3000/health || exit 1
          echo "✅ Health check passed!"

          # API test
          curl -f -X POST http://$CONTAINER_IP:3000/ask \
            -H "Content-Type: application/json" \
            -d '{"question":"test","mode":"yoga"}' || exit 1
          echo "✅ API test passed!"

          # Cleanup
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
        echo "📤 Pushing image to ECR..."
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-credentials'
        ]]) {
          sh '''
            # Login to ECR
            aws ecr get-login-password --region $AWS_REGION | \
              docker login --username AWS --password-stdin $ECR_REGISTRY

            # Push versioned tag
            docker push $FULL_IMAGE_NAME

            # Push latest tag
            docker push $ECR_REGISTRY/$ECR_REPO:latest

            echo "✅ Image pushed: $FULL_IMAGE_NAME"
          '''
        }
      }
    }

    stage('Deploy to EC2') {
      steps {
        echo "🚀 Deploying to App EC2..."
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

              echo '📦 Logging into ECR...'
              aws ecr get-login-password --region ap-south-1 | \
                docker login --username AWS \
                --password-stdin $ECR_REGISTRY

              echo '📥 Pulling new image...'
              docker pull $FULL_IMAGE_NAME

              echo '🔄 Replacing container...'
              docker stop bharatgpt-mini || true
              docker rm bharatgpt-mini || true

              echo '▶️ Starting new container...'
              docker run -d \
                --name bharatgpt-mini \
                --restart always \
                -p 80:3000 \
                --memory 256m \
                --cpus 0.5 \
                $FULL_IMAGE_NAME

              echo '🏥 Verifying deployment...'
              sleep 5
              curl -f http://localhost/health || exit 1

              echo '🧹 Cleaning old images...'
              docker image prune -f

              echo '✅ Deployment successful!'
            "
          '''
        }
      }
    }
  }

  post {
    success {
      echo """
      ╔════════════════════════════════════╗
      ║   ✅ PIPELINE SUCCEEDED!           ║
      ║   Build: #${BUILD_NUMBER}          ║
      ║   App: http://${APP_EC2_IP}        ║
      ╚════════════════════════════════════╝
      """
    }
    failure {
      echo """
      ╔════════════════════════════════════╗
      ║   ❌ PIPELINE FAILED!              ║
      ║   Build: #${BUILD_NUMBER}          ║
      ║   Check logs above                 ║
      ╚════════════════════════════════════╝
      """
    }
    always {
      echo "🧹 Cleaning up build artifacts..."
      sh '''
        docker rmi $FULL_IMAGE_NAME || true
        docker rmi $ECR_REGISTRY/$ECR_REPO:latest || true
        docker image prune -f || true
      '''
    }
  }
}
