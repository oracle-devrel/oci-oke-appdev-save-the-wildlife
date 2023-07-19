FROM --platform=linux/amd64 container-registry.oracle.com/java/jdk-no-fee-term:latest

VOLUME /tmp
COPY build/libs/*.jar score.jar

ENTRYPOINT ["java","-jar","/score.jar"]