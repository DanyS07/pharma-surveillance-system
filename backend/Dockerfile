# 1. Use Node 20 on Alpine Linux (the lightest version)
FROM node:20-alpine

# 2. Install build tools needed for Argon2 (C++ compilation)
RUN apk add --no-cache python3 make g++

# 3. Set the working directory
WORKDIR /usr/src/app

# 4. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your backend code
COPY . .

# 6. Create the uploads folder for Multer (so it doesn't crash)
RUN mkdir -p uploads

# 7. Expose the port your Express app uses
EXPOSE 5000

# 8. Use the dev script we defined in package.json
CMD ["npm", "run", "dev"]