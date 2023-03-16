FROM --platform=linux/amd64 eclipse-temurin:19

VOLUME /tmp
COPY build/libs/*.jar score.jar

ENTRYPOINT ["java","-jar","/score.jar"]