# Select the image to use
# Build this image with docker build . -t clara-backend:latest
FROM alpine:latest

RUN apk add npm

## Install dependencies in the root of the Container
COPY package-lock.json package.json ./
ENV NODE_PATH=/node_modules
ENV PATH=$PATH:/node_modules/.bin
RUN npm install

# Add project files to /app route in Container
ADD . /app

# Set working dir to /app
WORKDIR /app

# expose port 3000
EXPOSE 3000 5555 

ENTRYPOINT [ "/bin/sh", "-c", "redis-server --daemonize yes && npm run start" ]