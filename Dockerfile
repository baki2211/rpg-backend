FROM node:16

WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy ALL files (including src directory)
COPY . .

EXPOSE 5001

# Corrected CMD to point to src/index.js
CMD ["npx", "nodemon", "src/index.js"]

# CMD populate the database and start the server
# Uncomment the following line if you want to seed the database on container start
CMD npm run seed && npx nodemon src/index.js
