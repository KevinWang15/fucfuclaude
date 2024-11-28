# Use Node.js LTS (slim version for smaller image size)
FROM node:20-slim

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json ./
RUN npm install

# Copy public dir
COPY public ./public

# Copy app source
COPY *.js ./

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "index.js"]

# docker run --name fucfuclaude -p 3000:3000 -v $(pwd)/database.sqlite:/app/database.sqlite -v $(pwd)/config.json:/app/config.json fucfuclaude